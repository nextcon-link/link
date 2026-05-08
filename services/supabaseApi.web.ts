const notAvailableOnWeb = () => {
  throw new Error("Supabase API is not available in the web share view.");
};

type Label = {
  id: string;
};

type Event = {
  id: string;
};

export const supabase = {
  auth: {
    getSession: notAvailableOnWeb,
    getUser: notAvailableOnWeb,
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }),
    signInWithPassword: notAvailableOnWeb,
    signUp: notAvailableOnWeb,
    signOut: notAvailableOnWeb,
  },
  functions: {
    invoke: notAvailableOnWeb,
  },
  from: notAvailableOnWeb,
  rpc: notAvailableOnWeb,
};

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
  updated_at: string;
  deleted_at: string | null;
};

export async function pushLabels(_rows: Label[]): Promise<Set<string>> {
  return new Set();
}

export async function deleteLabels(_ids: string[]): Promise<void> {}

export async function fetchRemoteLabelChanges(
  _since: number,
): Promise<RemoteLabel[]> {
  return [];
}

export async function pushEvents(_rows: Event[]): Promise<Set<string>> {
  return new Set();
}

export async function deleteEvents(_ids: string[]): Promise<void> {}

export async function fetchRemoteEventChanges(
  _since: number,
): Promise<RemoteEvent[]> {
  return [];
}

export async function triggerGoogleSyncNow(): Promise<void> {}
