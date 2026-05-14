import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { Event, Label } from '../database/schema';
import type { sharingMode } from '@/utils/events';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

function isStoredSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as {
    access_token?: unknown;
    user?: { id?: unknown };
  };

  return (
    'user' in value &&
    'access_token' in value &&
    typeof candidate.access_token === 'string' &&
    typeof candidate.user?.id === 'string'
  );
}

export async function getPersistedAuthSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearPersistedAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    SUPABASE_AUTH_STORAGE_KEY,
    `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`,
    `${SUPABASE_AUTH_STORAGE_KEY}-user`,
  ]);
}

// Remote types — timestamps are ISO strings in Supabase
export type RemoteLabel = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_visible: boolean;
  google_calendar_id: string | null;
  google_access_role: string | null;
  google_sync_enabled: boolean;
  google_is_readonly: boolean;
  sharing_mode: sharingMode;
  deleted_at: string | null;
  updated_at: string;
};

export type RemoteEvent = {
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
  sharing_mode: sharingMode;
  updated_at: string;
  deleted_at: string | null;
};

// ── Labels ──────────────────────────────────────────────────────────────────

export async function pushLabels(rows: Label[]): Promise<RemoteLabel[]> {
  const payload = rows.map((l) => ({
    id: l.id,
    user_id: l.userId,
    name: l.name,
    color: l.color,
    is_visible: l.isVisible,
    google_sync_enabled: l.googleSyncEnabled,
    sharing_mode: l.sharingMode,
    deleted_at: l.deletedAt ? new Date(l.deletedAt).toISOString() : null,
  }));
  const { data, error } = await supabase
    .from('labels')
    .upsert(payload, { onConflict: 'id' })
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function deleteLabels(ids: string[]): Promise<RemoteLabel[]> {
  const { data, error } = await supabase
    .from('labels')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function fetchRemoteLabelChanges(since: number): Promise<RemoteLabel[]> {
  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .gt('updated_at', new Date(since).toISOString())
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function pushEvents(rows: Event[]): Promise<RemoteEvent[]> {
  const payload = rows.map((e) => ({
    id: e.id,
    user_id: e.userId,
    title: e.title,
    start_time: new Date(e.startTime).toISOString(),
    end_time: new Date(e.endTime).toISOString(),
    is_all_day: e.isAllDay,
    label_id: e.labelId,
    recurrence_rule: e.recurrenceRule,
    recurring_event_id: e.recurringEventId,
    original_start_time: e.originalStartTime
      ? new Date(e.originalStartTime).toISOString()
      : null,
    sharing_mode: e.sharingMode,
    deleted_at: e.deletedAt ? new Date(e.deletedAt).toISOString() : null,
  }));
  const { data, error } = await supabase
    .from('events')
    .upsert(payload, { onConflict: 'id' })
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function deleteEvents(ids: string[]): Promise<RemoteEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
    .select('*');
  if (error) throw error;
  return data ?? [];
}

export async function fetchRemoteEventChanges(since: number): Promise<RemoteEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gt('updated_at', new Date(since).toISOString())
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getFunctionErrorDetail(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error);
  const context =
    error && typeof error === 'object' && 'context' in error
      ? (error.context as Response | Record<string, unknown> | undefined)
      : undefined;

  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      return typeof body?.error === 'string' ? body.error : JSON.stringify(body);
    } catch {
      return context.clone().text().catch(() => fallback);
    }
  }

  if (context) {
    return JSON.stringify(context);
  }

  return fallback;
}

export async function triggerGoogleSyncNow(): Promise<void> {
  const { error } = await supabase.functions.invoke('google-sync-now', {
    body: { mode: 'sync' },
  });
  if (!error) return;

  const detail = await getFunctionErrorDetail(error);
  if (detail.includes('google_not_connected')) {
    return;
  }

  throw new Error(detail);
}
