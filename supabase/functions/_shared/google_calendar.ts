import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-resource-id, x-goog-resource-state",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const DEFAULT_COLOR = "#4A90E2";

export type GoogleConnectionStatus = {
  isConnected: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  calendarCount: number;
  watchUnsupportedCount: number;
  failedCalendarCount: number;
};

type GoogleConnection = {
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  is_connected: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  updated_at: string | null;
};

type GoogleOAuthState = {
  userId: string;
  appRedirectTo: string;
  nonce: string;
  exp: number;
};

type CalendarLink = {
  id: string;
  user_id: string;
  label_id: string | null;
  google_calendar_id: string;
  google_calendar_summary: string;
  google_access_role: string | null;
  google_sync_token: string | null;
  watch_channel_id: string | null;
  watch_resource_id: string | null;
  watch_expires_at: string | null;
  watch_supported: boolean;
  is_enabled: boolean;
  is_readonly: boolean;
  last_sync_at: string | null;
  last_error: string | null;
};

type RemoteLabel = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  google_calendar_id: string | null;
  google_access_role: string | null;
  google_sync_enabled: boolean;
  google_is_readonly: boolean;
  deleted_at: string | null;
  updated_at: string;
};

type RemoteEvent = {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  label_id: string | null;
  recurrence_rule: string | null;
  recurring_event_id: string | null;
  original_start_time: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_etag: string | null;
  google_updated_at: string | null;
  deleted_at: string | null;
  updated_at: string;
};

type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  backgroundColor?: string;
  accessRole?: string;
  deleted?: boolean;
};

type GoogleEvent = {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  updated?: string;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
};

export function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_env_${name}`);
  return value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function getStateKey(): Promise<CryptoKey> {
  const secret = getRequiredEnv("GOOGLE_OAUTH_STATE_SECRET");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createOAuthState(
  userId: string,
  appRedirectTo: string,
): Promise<string> {
  const payload: GoogleOAuthState = {
    userId,
    appRedirectTo,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadEncoded = base64UrlEncode(payloadBytes);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getStateKey(),
    new TextEncoder().encode(payloadEncoded),
  );
  return `${payloadEncoded}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyOAuthState(state: string): Promise<GoogleOAuthState> {
  const [payloadEncoded, signatureEncoded] = state.split(".");
  if (!payloadEncoded || !signatureEncoded) throw new Error("invalid_oauth_state");

  const valid = await crypto.subtle.verify(
    "HMAC",
    await getStateKey(),
    base64UrlDecode(signatureEncoded),
    new TextEncoder().encode(payloadEncoded),
  );
  if (!valid) throw new Error("invalid_oauth_state");

  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadEncoded)),
  ) as GoogleOAuthState;
  if (payload.exp < Date.now()) throw new Error("expired_oauth_state");
  return payload;
}

export async function createGoogleAuthUrl(
  userId: string,
  appRedirectTo: string,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: getRequiredEnv("GOOGLE_OAUTH_CALLBACK_URL"),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: await createOAuthState(userId, appRedirectTo),
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function redirectToApp(
  appRedirectTo: string,
  params: Record<string, string>,
): Response {
  const url = new URL(appRedirectTo);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      ...corsHeaders,
    },
  });
}

export function getUserClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    },
  );
}

export async function requireUser(req: Request): Promise<string> {
  const supabase = getUserClient(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("not_authenticated");
  return data.user.id;
}

async function setConnectionError(userId: string, message: string) {
  const supabase = getAdminClient();
  await supabase
    .from("google_connections")
    .upsert({
      user_id: userId,
      is_connected: false,
      last_error: message,
      updated_at: new Date().toISOString(),
    });
}

async function runSyncStep(
  userId: string,
  step: string,
  fn: () => Promise<void>,
) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${step}: ${message}`);
  }
}

async function clearConnectionError(userId: string) {
  const supabase = getAdminClient();
  await supabase
    .from("google_connections")
    .update({
      is_connected: true,
      last_error: null,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function setCalendarLinkStatus(
  linkId: string,
  patch: {
    watch_supported?: boolean;
    last_sync_at?: string | null;
    last_error?: string | null;
  },
) {
  const supabase = getAdminClient();
  await supabase
    .from("google_calendar_links")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", linkId);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isGoogleReadonlyError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("virtualCalendarManipulation") ||
    message.includes("This calendar is read-only")
  );
}

async function markCalendarLinkReadonly(
  link: CalendarLink,
  message: string,
) {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  await supabase
    .from("google_calendar_links")
    .update({
      is_readonly: true,
      watch_supported: false,
      last_error: message,
      updated_at: now,
    })
    .eq("id", link.id);

  if (link.label_id) {
    await supabase
      .from("labels")
      .update({
        google_is_readonly: true,
        updated_at: now,
      })
      .eq("id", link.label_id)
      .eq("user_id", link.user_id);
  } else {
    await supabase
      .from("labels")
      .update({
        google_is_readonly: true,
        updated_at: now,
      })
      .eq("user_id", link.user_id)
      .eq("google_calendar_id", link.google_calendar_id);
  }

  link.is_readonly = true;
  link.watch_supported = false;
  link.last_error = message;
}

export async function getConnectionStatus(userId: string): Promise<GoogleConnectionStatus> {
  const supabase = getAdminClient();
  const [{ data: connection }, { count }, { count: watchUnsupportedCount }, { count: failedCalendarCount }] = await Promise.all([
    supabase
      .from("google_connections")
      .select("is_connected,last_sync_at,last_error")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("google_calendar_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_enabled", true),
    supabase
      .from("google_calendar_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_enabled", true)
      .eq("watch_supported", false),
    supabase
      .from("google_calendar_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_enabled", true)
      .not("last_error", "is", null),
  ]);

  return {
    isConnected: Boolean(connection?.is_connected),
    lastSyncAt: connection?.last_sync_at ?? null,
    lastError: connection?.last_error ?? null,
    calendarCount: count ?? 0,
    watchUnsupportedCount: watchUnsupportedCount ?? 0,
    failedCalendarCount: failedCalendarCount ?? 0,
  };
}

export async function storeGoogleTokens(
  userId: string,
  payload: {
    providerToken?: string;
    providerRefreshToken?: string;
    expiresAt?: number;
    scope?: string;
  },
) {
  const supabase = getAdminClient();
  const { data: existing } = await supabase
    .from("google_connections")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  const refreshToken = payload.providerRefreshToken ?? existing?.refresh_token;
  if (!payload.providerToken && !refreshToken) {
    throw new Error("missing_google_provider_tokens");
  }

  const expiresAt = payload.expiresAt
    ? new Date(payload.expiresAt * 1000).toISOString()
    : new Date(Date.now() + 55 * 60 * 1000).toISOString();

  const { error } = await supabase.from("google_connections").upsert({
    user_id: userId,
    access_token: payload.providerToken ?? null,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    scope: payload.scope ?? "https://www.googleapis.com/auth/calendar",
    is_connected: true,
    last_error: null,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function exchangeGoogleAuthCode(
  userId: string,
  code: string,
) {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: getRequiredEnv("GOOGLE_OAUTH_CALLBACK_URL"),
    code,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`google_code_exchange_failed_${response.status}_${text.slice(0, 160)}`);
  }

  const token = await response.json();
  await storeGoogleTokens(userId, {
    providerToken: token.access_token,
    providerRefreshToken: token.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(token.expires_in ?? 3600),
    scope: token.scope ?? GOOGLE_CALENDAR_SCOPE,
  });
}

async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("google_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  const connection = data as GoogleConnection | null;
  if (!connection?.refresh_token && !connection?.access_token) {
    throw new Error("google_not_connected");
  }

  const expiresAt = connection.expires_at
    ? new Date(connection.expires_at).getTime()
    : 0;
  if (connection.access_token && expiresAt - Date.now() > 120_000) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    return connection.access_token!;
  }

  const body = new URLSearchParams({
    client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    refresh_token: connection.refresh_token,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`google_token_refresh_failed_${response.status}`);
  }

  const token = await response.json();
  const nextExpiresAt = new Date(
    Date.now() + Number(token.expires_in ?? 3600) * 1000,
  ).toISOString();

  await supabase
    .from("google_connections")
    .update({
      access_token: token.access_token,
      expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return token.access_token;
}

async function googleFetch<T>(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = await getValidAccessToken(userId);
  const response = await fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`google_api_${response.status}_${text.slice(0, 160)}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

function isReadonly(accessRole?: string | null) {
  return accessRole !== "owner" && accessRole !== "writer";
}

function googleDateToIso(input?: { date?: string; dateTime?: string }) {
  if (!input) return null;
  if (input.dateTime) return new Date(input.dateTime).toISOString();
  if (input.date) return new Date(`${input.date}T00:00:00.000Z`).toISOString();
  return null;
}

function googleEventToPayload(
  userId: string,
  calendarId: string,
  labelId: string | null,
  event: GoogleEvent,
) {
  const startTime = googleDateToIso(event.start);
  const endTime = googleDateToIso(event.end);
  const googleUpdatedAt = event.updated ?? new Date().toISOString();
  const deletedAt = event.status === "cancelled" ? googleUpdatedAt : null;

  if (!startTime || !endTime) return null;

  return {
    id: event.extendedProperties?.private?.linkEventId ?? crypto.randomUUID(),
    user_id: userId,
    title: event.summary ?? "(제목 없음)",
    start_time: startTime,
    end_time: endTime,
    is_all_day: Boolean(event.start?.date && !event.start?.dateTime),
    label_id: labelId,
    recurrence_rule: event.recurrence?.[0] ?? null,
    recurring_event_id: event.recurringEventId ?? null,
    original_start_time: googleDateToIso(event.originalStartTime),
    google_event_id: event.id,
    google_calendar_id: calendarId,
    google_etag: event.etag ?? null,
    google_updated_at: googleUpdatedAt,
    deleted_at: deletedAt,
  };
}

function eventToGooglePayload(event: RemoteEvent) {
  const privateProperties: Record<string, string> = { linkEventId: event.id };
  return {
    summary: event.title,
    start: event.is_all_day
      ? { date: event.start_time.slice(0, 10) }
      : { dateTime: event.start_time },
    end: event.is_all_day
      ? { date: event.end_time.slice(0, 10) }
      : { dateTime: event.end_time },
    recurrence: event.recurrence_rule ? [event.recurrence_rule] : undefined,
    extendedProperties: {
      private: privateProperties,
    },
  };
}

async function createGoogleCalendarForLabel(userId: string, label: RemoteLabel) {
  const calendar = await googleFetch<{ id: string; summary: string }>(
    userId,
    "/calendars",
    {
      method: "POST",
      body: JSON.stringify({
        summary: label.name,
        description: "Created by Link",
      }),
    },
  );

  const supabase = getAdminClient();
  await supabase
    .from("labels")
    .update({
      google_calendar_id: calendar.id,
      google_access_role: "owner",
      google_sync_enabled: true,
      google_is_readonly: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", label.id)
    .eq("user_id", userId);

    await supabase.from("google_calendar_links").upsert({
      user_id: userId,
      label_id: label.id,
      google_calendar_id: calendar.id,
      google_calendar_summary: calendar.summary,
      google_access_role: "owner",
      watch_supported: true,
      is_enabled: true,
      is_readonly: false,
      updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,google_calendar_id" });
}

async function importGoogleCalendars(userId: string): Promise<CalendarLink[]> {
  const supabase = getAdminClient();
  const response = await googleFetch<{ items?: GoogleCalendarListEntry[] }>(
    userId,
    "/users/me/calendarList?showHidden=true",
  );
  const calendars = (response.items ?? []).filter((calendar) => !calendar.deleted);

  for (const calendar of calendars) {
    const accessRole = calendar.accessRole ?? "reader";
    const readonly = isReadonly(accessRole);
    const { data: existingLink } = await supabase
      .from("google_calendar_links")
      .select("*")
      .eq("user_id", userId)
      .eq("google_calendar_id", calendar.id)
      .maybeSingle();

    let labelId = existingLink?.label_id as string | null;
    if (!labelId) {
      labelId = crypto.randomUUID();
      await supabase.from("labels").upsert({
        id: labelId,
        user_id: userId,
        name: calendar.summary,
        color: calendar.backgroundColor ?? DEFAULT_COLOR,
        is_visible: true,
        google_calendar_id: calendar.id,
        google_access_role: accessRole,
        google_sync_enabled: true,
        google_is_readonly: readonly,
        updated_at: new Date().toISOString(),
      });
    } else {
      await supabase
        .from("labels")
        .update({
          name: calendar.summary,
          color: calendar.backgroundColor ?? DEFAULT_COLOR,
          google_calendar_id: calendar.id,
          google_access_role: accessRole,
          google_sync_enabled: true,
          google_is_readonly: readonly,
          updated_at: new Date().toISOString(),
        })
        .eq("id", labelId)
        .eq("user_id", userId);
    }

    await supabase.from("google_calendar_links").upsert({
      user_id: userId,
      label_id: labelId,
      google_calendar_id: calendar.id,
      google_calendar_summary: calendar.summary,
      google_access_role: accessRole,
      watch_supported: !readonly,
      is_enabled: true,
      is_readonly: readonly,
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,google_calendar_id" });
  }

  const { data, error } = await supabase
    .from("google_calendar_links")
    .select("*")
    .eq("user_id", userId)
    .eq("is_enabled", true);

  if (error) throw error;
  return (data ?? []) as CalendarLink[];
}

async function createCalendarsForLocalLabels(userId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("labels")
    .select("*")
    .eq("user_id", userId)
    .eq("google_sync_enabled", true)
    .eq("google_is_readonly", false)
    .is("google_calendar_id", null);

  if (error) throw error;

  for (const label of (data ?? []) as RemoteLabel[]) {
    await createGoogleCalendarForLabel(userId, label);
  }
}

async function pushSupabaseLabelsToGoogle(userId: string) {
  const supabase = getAdminClient();
  const { data: labelRows, error } = await supabase
    .from("labels")
    .select("*")
    .eq("user_id", userId)
    .eq("google_sync_enabled", true)
    .eq("google_is_readonly", false)
    .not("google_calendar_id", "is", null);

  if (error) throw error;

  const { data: linkRows, error: linkError } = await supabase
    .from("google_calendar_links")
    .select("*")
    .eq("user_id", userId)
    .eq("is_enabled", true);

  if (linkError) throw linkError;
  const linksByCalendarId = new Map(
    ((linkRows ?? []) as CalendarLink[]).map((link) => [
      link.google_calendar_id,
      link,
    ]),
  );

  for (const label of (labelRows ?? []) as RemoteLabel[]) {
    if (!label.google_calendar_id) continue;
    const link = linksByCalendarId.get(label.google_calendar_id);
    if (!link || link.is_readonly) continue;

    const labelUpdatedAt = new Date(label.updated_at).getTime();
    const linkUpdatedAt = link.updated_at
      ? new Date(link.updated_at).getTime()
      : 0;
    if (labelUpdatedAt <= linkUpdatedAt) continue;

    try {
      const calendar = await googleFetch<{ id: string; summary: string }>(
        userId,
        `/calendars/${encodeURIComponent(label.google_calendar_id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ summary: label.name }),
        },
      );

      await supabase
        .from("google_calendar_links")
        .update({
          google_calendar_summary: calendar.summary,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id);
    } catch (error) {
      const message = getErrorMessage(error);
      if (isGoogleReadonlyError(error)) {
        await markCalendarLinkReadonly(link, message);
      } else {
        await setCalendarLinkStatus(link.id, { last_error: message });
      }
    }
  }
}

async function pushSupabaseEventsToGoogle(userId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;

  const { data: labelRows, error: labelError } = await supabase
    .from("labels")
    .select("id,google_calendar_id,google_is_readonly")
    .eq("user_id", userId);

  if (labelError) throw labelError;
  const labelsById = new Map(
    (labelRows ?? []).map((label) => [
      label.id,
      {
        google_calendar_id: label.google_calendar_id as string | null,
        google_is_readonly: Boolean(label.google_is_readonly),
      },
    ]),
  );

  const { data: linkRows, error: linkError } = await supabase
    .from("google_calendar_links")
    .select("*")
    .eq("user_id", userId)
    .eq("is_enabled", true);

  if (linkError) throw linkError;
  const linksByCalendarId = new Map(
    ((linkRows ?? []) as CalendarLink[]).map((link) => [
      link.google_calendar_id,
      link,
    ]),
  );

  for (const row of data ?? []) {
    const event = row as RemoteEvent;
    const label = event.label_id ? labelsById.get(event.label_id) : null;
    const targetCalendarId = event.label_id
      ? label?.google_calendar_id
      : event.google_calendar_id;
    if (!targetCalendarId || label?.google_is_readonly) continue;

    const link = linksByCalendarId.get(targetCalendarId);
    if (!link || link.is_readonly) continue;

    const lastCalendarSyncAt = link.last_sync_at
      ? new Date(link.last_sync_at).getTime()
      : 0;
    const changedAfterGoogle =
      !event.google_updated_at ||
      !event.google_event_id ||
      new Date(event.updated_at).getTime() > lastCalendarSyncAt;
    if (!changedAfterGoogle && !event.deleted_at) continue;

    if (event.deleted_at) {
      if (event.google_event_id && event.google_calendar_id) {
        const sourceLink = linksByCalendarId.get(event.google_calendar_id);
        try {
          await googleFetch(userId, `/calendars/${encodeURIComponent(event.google_calendar_id)}/events/${encodeURIComponent(event.google_event_id)}`, {
            method: "DELETE",
          });
        } catch (error) {
          const message = getErrorMessage(error);
          if (!message.includes("google_api_404") && !message.includes("google_api_410")) {
            if (sourceLink && isGoogleReadonlyError(error)) {
              await markCalendarLinkReadonly(sourceLink, message);
              continue;
            }
            throw error;
          }
        }
        await supabase
          .from("events")
          .update({
            google_event_id: null,
            google_etag: null,
            google_updated_at: new Date().toISOString(),
          })
          .eq("id", event.id)
          .eq("user_id", userId);
      }
      continue;
    }

    if (
      event.google_event_id &&
      event.google_calendar_id &&
      event.google_calendar_id !== targetCalendarId
    ) {
      await googleFetch(userId, `/calendars/${encodeURIComponent(event.google_calendar_id)}/events/${encodeURIComponent(event.google_event_id)}`, {
        method: "DELETE",
      }).catch(() => null);
      event.google_event_id = null;
      event.google_calendar_id = null;
    }

    const googlePayload = eventToGooglePayload(event);
    let googleEvent: GoogleEvent;
    try {
      googleEvent = event.google_event_id
        ? await googleFetch<GoogleEvent>(
            userId,
            `/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(event.google_event_id)}`,
            { method: "PATCH", body: JSON.stringify(googlePayload) },
          )
        : await googleFetch<GoogleEvent>(
            userId,
            `/calendars/${encodeURIComponent(targetCalendarId)}/events`,
            { method: "POST", body: JSON.stringify(googlePayload) },
          );
    } catch (error) {
      const message = getErrorMessage(error);
      if (isGoogleReadonlyError(error)) {
        await markCalendarLinkReadonly(link, message);
        continue;
      }
      throw error;
    }

    await supabase
      .from("events")
      .update({
        google_event_id: googleEvent.id,
        google_calendar_id: targetCalendarId,
        google_etag: googleEvent.etag ?? null,
        google_updated_at: googleEvent.updated ?? new Date().toISOString(),
      })
      .eq("id", event.id)
      .eq("user_id", userId);
  }
}

async function pullGoogleEventsForLink(userId: string, link: CalendarLink) {
  const supabase = getAdminClient();
  let pageToken: string | undefined;
  let syncToken = link.google_sync_token ?? undefined;
  let fullResync = !syncToken;

  if (fullResync) {
    await supabase
      .from("events")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("google_calendar_id", link.google_calendar_id)
      .not("google_event_id", "is", null);
  }

  while (true) {
    const params = new URLSearchParams({
      showDeleted: "true",
      singleEvents: "false",
      maxResults: "2500",
    });
    if (pageToken) params.set("pageToken", pageToken);
    if (syncToken) params.set("syncToken", syncToken);

    let response: { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string };
    try {
      response = await googleFetch(
        userId,
        `/calendars/${encodeURIComponent(link.google_calendar_id)}/events?${params.toString()}`,
      );
    } catch (error) {
      if (String(error).includes("google_api_410")) {
        syncToken = undefined;
        fullResync = true;
        await supabase
          .from("events")
          .update({ deleted_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("google_calendar_id", link.google_calendar_id)
          .not("google_event_id", "is", null);
        continue;
      }
      throw error;
    }

    for (const googleEvent of response.items ?? []) {
      if (googleEvent.status === "cancelled") {
        await supabase
          .from("events")
          .update({
            deleted_at: googleEvent.updated ?? new Date().toISOString(),
            google_updated_at: googleEvent.updated ?? new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("google_calendar_id", link.google_calendar_id)
          .eq("google_event_id", googleEvent.id);
        continue;
      }

      const payload = googleEventToPayload(
        userId,
        link.google_calendar_id,
        link.label_id,
        googleEvent,
      );
      if (!payload) continue;

      const { data: existingEvent } = await supabase
        .from("events")
        .select("id")
        .eq("user_id", userId)
        .eq("google_calendar_id", link.google_calendar_id)
        .eq("google_event_id", googleEvent.id)
        .maybeSingle();

      if (existingEvent?.id && !googleEvent.extendedProperties?.private?.linkEventId) {
        payload.id = existingEvent.id;
      }

      await supabase
        .from("events")
        .upsert(payload, { onConflict: "id" });
    }

    if (response.nextPageToken) {
      pageToken = response.nextPageToken;
      continue;
    }

    if (response.nextSyncToken) {
      await supabase
        .from("google_calendar_links")
        .update({
          google_sync_token: response.nextSyncToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id);
    }
    break;
  }
}

async function pullGoogleEvents(userId: string, links: CalendarLink[]) {
  for (const link of links) {
    try {
      await pullGoogleEventsForLink(userId, link);
      await setCalendarLinkStatus(link.id, {
        last_sync_at: new Date().toISOString(),
        last_error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await setCalendarLinkStatus(link.id, {
        last_error: message,
      });
    }
  }
}

export async function ensureGoogleWatches(userId: string, links: CalendarLink[]) {
  const webhookUrl = Deno.env.get("GOOGLE_WEBHOOK_URL");
  if (!webhookUrl) return;

  const supabase = getAdminClient();
  const renewBefore = Date.now() + 24 * 60 * 60 * 1000;

  for (const link of links) {
    if (link.is_readonly) {
      if (link.watch_supported) {
        await setCalendarLinkStatus(link.id, {
          watch_supported: false,
          last_error: null,
        });
      }
      continue;
    }

    if (link.watch_expires_at && new Date(link.watch_expires_at).getTime() > renewBefore) {
      continue;
    }

    const channelId = crypto.randomUUID();
    let watch: {
      id: string;
      resourceId: string;
      expiration?: string;
    };

    try {
      watch = await googleFetch(
        userId,
        `/calendars/${encodeURIComponent(link.google_calendar_id)}/events/watch`,
        {
          method: "POST",
          body: JSON.stringify({
            id: channelId,
            type: "web_hook",
            address: webhookUrl,
            token: `user=${userId}`,
          }),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("pushNotSupportedForRequestedResource") ||
        message.includes("google_api_400")
      ) {
        await supabase
          .from("google_calendar_links")
          .update({
            watch_channel_id: null,
            watch_resource_id: null,
            watch_expires_at: null,
            watch_supported: false,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", link.id);
        continue;
      }
      throw error;
    }

    await supabase
      .from("google_calendar_links")
      .update({
        watch_channel_id: watch.id,
        watch_resource_id: watch.resourceId,
        watch_expires_at: watch.expiration
          ? new Date(Number(watch.expiration)).toISOString()
          : null,
        watch_supported: true,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);
  }
}

export async function syncGoogleForUser(userId: string) {
  try {
    await runSyncStep(userId, "create_local_label_calendars", () =>
      createCalendarsForLocalLabels(userId),
    );
    await runSyncStep(userId, "push_labels_to_google", () =>
      pushSupabaseLabelsToGoogle(userId),
    );
    const links = await importGoogleCalendars(userId).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`import_google_calendars: ${message}`);
    });
    await runSyncStep(userId, "push_events_to_google", () =>
      pushSupabaseEventsToGoogle(userId),
    );
    await runSyncStep(userId, "pull_events_from_google", () =>
      pullGoogleEvents(userId, links),
    );
    await runSyncStep(userId, "ensure_google_watches", () =>
      ensureGoogleWatches(userId, links),
    );
    await clearConnectionError(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setConnectionError(userId, message);
    throw error;
  }
}

export async function syncGoogleForChannel(channelId: string) {
  const supabase = getAdminClient();
  const { data: link, error } = await supabase
    .from("google_calendar_links")
    .select("*")
    .eq("watch_channel_id", channelId)
    .maybeSingle();

  if (error) throw error;
  if (!link) return;

  const calendarLink = link as CalendarLink;
  await pullGoogleEventsForLink(calendarLink.user_id, calendarLink);
  await clearConnectionError(calendarLink.user_id);
}

export async function disconnectGoogleForUser(userId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("google_calendar_links")
    .select("*")
    .eq("user_id", userId)
    .eq("is_enabled", true);

  if (error) throw error;

  for (const link of (data ?? []) as CalendarLink[]) {
    if (!link.watch_channel_id || !link.watch_resource_id) continue;
    await googleFetch(userId, "/channels/stop", {
      method: "POST",
      body: JSON.stringify({
        id: link.watch_channel_id,
        resourceId: link.watch_resource_id,
      }),
    }).catch(() => null);
  }

  const now = new Date().toISOString();
  await supabase
    .from("google_connections")
    .update({
      access_token: null,
      refresh_token: null,
      expires_at: null,
      is_connected: false,
      last_error: null,
      updated_at: now,
    })
    .eq("user_id", userId);

  await supabase
    .from("google_calendar_links")
    .update({
      is_enabled: false,
      watch_channel_id: null,
      watch_resource_id: null,
      watch_expires_at: null,
      last_error: null,
      updated_at: now,
    })
    .eq("user_id", userId);

  await supabase
    .from("labels")
    .update({
      google_sync_enabled: false,
      updated_at: now,
    })
    .eq("user_id", userId)
    .not("google_calendar_id", "is", null);
}

export async function renewDueWatches() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("google_connections")
    .select("user_id")
    .eq("is_connected", true);

  if (error) throw error;

  for (const row of data ?? []) {
    await syncGoogleForUser(row.user_id as string);
  }
}
