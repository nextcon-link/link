import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/services/supabaseApi";

WebBrowser.maybeCompleteAuthSession();

export type GoogleConnectionStatus = {
  isConnected: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  calendarCount: number;
};

async function invokeGoogleSync<T>(
  mode: "status" | "auth-url" | "sync",
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("google-sync-now", {
    body: { mode, ...payload },
  });

  if (error) {
    let detail = "";
    const context =
      "context" in error
        ? (error.context as Response | Record<string, unknown> | undefined)
        : undefined;

    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        detail = typeof body?.error === "string" ? body.error : JSON.stringify(body);
      } catch {
        detail = await context.clone().text().catch(() => "");
      }
    } else if (context) {
      detail = JSON.stringify(context);
    }

    throw new Error(detail || error.message);
  }
  return data as T;
}

export async function connectGoogleCalendar(): Promise<GoogleConnectionStatus> {
  const appRedirectTo = Linking.createURL("google");
  const { url } = await invokeGoogleSync<{ url: string }>("auth-url", {
    appRedirectTo,
  });

  const browserResult = await WebBrowser.openAuthSessionAsync(
    url,
    appRedirectTo,
  );

  if (browserResult.type !== "success") {
    throw new Error("google_oauth_cancelled");
  }

  const parsed = Linking.parse(browserResult.url);
  const query = parsed.queryParams ?? {};
  if (query.error) {
    throw new Error(String(query.error));
  }

  return invokeGoogleSync<GoogleConnectionStatus>("sync");
}

export async function syncGoogleCalendarNow(): Promise<GoogleConnectionStatus> {
  return invokeGoogleSync<GoogleConnectionStatus>("sync");
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  return invokeGoogleSync<GoogleConnectionStatus>("status");
}
