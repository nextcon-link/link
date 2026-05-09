import AsyncStorage from '@react-native-async-storage/async-storage';
import { ne, eq, and } from 'drizzle-orm';
import { db } from '../database';
import { labels, events } from '../database/schema';
import {
  pushLabels, pushEvents,
  deleteLabels, deleteEvents,
  fetchRemoteLabelChanges, fetchRemoteEventChanges,
  triggerGoogleSyncNow,
  type RemoteEvent,
  type RemoteLabel,
} from './supabaseApi';
import { getCurrentUserId } from '@/utils/storage';

const LAST_SYNC_KEY = 'last_sync_timestamp';
let lastGoogleSyncAttemptAt = 0;
let lastPullAttemptAt = 0;

async function getLastSync(userId: string): Promise<number> {
  const val = await AsyncStorage.getItem(`${LAST_SYNC_KEY}_${userId}`);
  return val ? parseInt(val, 10) : 0;
}
async function setLastSync(userId: string, ts: number): Promise<void> {
  await AsyncStorage.setItem(`${LAST_SYNC_KEY}_${userId}`, String(ts));
}

function remoteTime(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

function maxRemoteUpdatedAt(
  current: number,
  rows: Array<{ updated_at: string }>,
): number {
  return rows.reduce(
    (max, row) => Math.max(max, remoteTime(row.updated_at)),
    current,
  );
}

function labelPatchFromRemote(remote: RemoteLabel) {
  return {
    name: remote.name,
    color: remote.color,
    isVisible: remote.is_visible,
    googleCalendarId: remote.google_calendar_id,
    googleAccessRole: remote.google_access_role,
    googleSyncEnabled: remote.google_sync_enabled,
    googleIsReadonly: remote.google_is_readonly,
    sharingMode: remote.sharing_mode,
    deletedAt: remoteTime(remote.deleted_at) || null,
    updatedAt: remoteTime(remote.updated_at),
  };
}

function eventPatchFromRemote(remote: RemoteEvent) {
  return {
    title: remote.title,
    startTime: remoteTime(remote.start_time),
    endTime: remoteTime(remote.end_time),
    isAllDay: remote.is_all_day,
    labelId: remote.label_id,
    recurrenceRule: remote.recurrence_rule,
    recurringEventId: remote.recurring_event_id,
    originalStartTime: remoteTime(remote.original_start_time) || null,
    googleEventId: remote.google_event_id,
    googleCalendarId: remote.google_calendar_id,
    googleEtag: remote.google_etag,
    googleUpdatedAt: remoteTime(remote.google_updated_at) || null,
    sharingMode: remote.sharing_mode,
    deletedAt: remoteTime(remote.deleted_at) || null,
    updatedAt: remoteTime(remote.updated_at),
  };
}

async function tryTriggerGoogleSyncNow(): Promise<void> {
  const now = Date.now();
  if (now - lastGoogleSyncAttemptAt < 5000) return;
  lastGoogleSyncAttemptAt = now;

  try {
    await triggerGoogleSyncNow();
  } catch (error) {
    console.warn('[sync] google sync trigger failed', error);
  }
}

// Flow B — push current user's pending local records to Supabase.
// Fails gracefully when offline; pending rows stay queued locally.
export async function pushChanges(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    let didPushRemoteChanges = false;

    // ── Labels ──────────────────────────────────────────────────────────────
    const pendingLabels = await db.select().from(labels)
      .where(and(ne(labels.syncStatus, 'synced'), eq(labels.userId, userId)));

    const labelsToDelete = pendingLabels.filter(l => l.syncStatus === 'pending_delete');
    const labelsToUpsert = pendingLabels.filter(l => l.syncStatus !== 'pending_delete');

    if (labelsToUpsert.length > 0) {
      const syncedLabels = await pushLabels(labelsToUpsert);
      didPushRemoteChanges = syncedLabels.length > 0;
      for (const remote of syncedLabels) {
        await db.update(labels)
          .set({
            ...labelPatchFromRemote(remote),
            syncStatus: 'synced',
          })
          .where(and(eq(labels.id, remote.id), eq(labels.userId, userId)));
      }
    }
    if (labelsToDelete.length > 0) {
      const deletedLabels = await deleteLabels(labelsToDelete.map(l => l.id));
      didPushRemoteChanges = true;
      const remoteDeletedLabelIds = new Set(deletedLabels.map((label) => label.id));
      for (const remote of deletedLabels) {
        await db.update(events)
          .set({
            labelId: null,
            syncStatus: 'synced',
            updatedAt: remoteTime(remote.updated_at),
          })
          .where(and(eq(events.labelId, remote.id), eq(events.userId, userId)));
        await db.delete(labels)
          .where(and(eq(labels.id, remote.id), eq(labels.userId, userId)));
      }
      for (const label of labelsToDelete) {
        if (remoteDeletedLabelIds.has(label.id)) continue;
        await db.delete(labels)
          .where(and(eq(labels.id, label.id), eq(labels.userId, userId)));
      }
    }

    // ── Events ───────────────────────────────────────────────────────────────
    const pendingEvents = await db.select().from(events)
      .where(and(ne(events.syncStatus, 'synced'), eq(events.userId, userId)));

    const eventsToDelete = pendingEvents.filter(e => e.syncStatus === 'pending_delete');
    const eventsToUpsert = pendingEvents.filter(e => e.syncStatus !== 'pending_delete');

    if (eventsToUpsert.length > 0) {
      const syncedEvents = await pushEvents(eventsToUpsert);
      didPushRemoteChanges = didPushRemoteChanges || syncedEvents.length > 0;
      for (const remote of syncedEvents) {
        await db.update(events)
          .set({
            ...eventPatchFromRemote(remote),
            syncStatus: 'synced',
          })
          .where(and(eq(events.id, remote.id), eq(events.userId, userId)));
      }
    }
    if (eventsToDelete.length > 0) {
      const deletedEvents = await deleteEvents(eventsToDelete.map(e => e.id));
      didPushRemoteChanges = true;
      const remoteDeletedEventIds = new Set(deletedEvents.map((event) => event.id));
      for (const remote of deletedEvents) {
        await db.delete(events)
          .where(and(eq(events.id, remote.id), eq(events.userId, userId)));
      }
      for (const event of eventsToDelete) {
        if (remoteDeletedEventIds.has(event.id)) continue;
        await db.delete(events)
          .where(and(eq(events.id, event.id), eq(events.userId, userId)));
      }
    }

    if (didPushRemoteChanges) {
      await tryTriggerGoogleSyncNow();
    }
  } catch (error) {
    console.warn('[sync] push failed', error);
  }
}

// Pull remote changes since last sync. Server wins for 'synced' local records only.
export async function pullChanges(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const since = await getLastSync(userId);
    let nextLastSync = since;

    // ── Labels (pull first — events FK depends on labels) ───────────────────
    const remoteLabels = await fetchRemoteLabelChanges(since);
    nextLastSync = maxRemoteUpdatedAt(nextLastSync, remoteLabels);
    for (const remote of remoteLabels) {
      if (remote.user_id !== userId) continue;

      const remoteUpdatedAt = remoteTime(remote.updated_at);
      const existing = await db.select().from(labels)
        .where(and(eq(labels.id, remote.id), eq(labels.userId, userId))).limit(1);

      if (remote.deleted_at) {
        if (
          existing.length > 0 &&
          (existing[0].syncStatus === 'synced' || existing[0].updatedAt <= remoteUpdatedAt)
        ) {
          await db.update(events)
            .set({
              labelId: null,
              syncStatus: 'synced',
              updatedAt: remoteUpdatedAt,
            })
            .where(and(eq(events.labelId, remote.id), eq(events.userId, userId)));
          await db.delete(labels)
            .where(and(eq(labels.id, remote.id), eq(labels.userId, userId)));
        }
        continue;
      }

      if (existing.length === 0) {
        await db.insert(labels).values({
          id: remote.id,
          userId: remote.user_id,
          name: remote.name,
          color: remote.color,
          isVisible: remote.is_visible,
          googleCalendarId: remote.google_calendar_id,
          googleAccessRole: remote.google_access_role,
          googleSyncEnabled: remote.google_sync_enabled,
          googleIsReadonly: remote.google_is_readonly,
          sharingMode: remote.sharing_mode,
          deletedAt: null,
          syncStatus: 'synced',
          updatedAt: remoteUpdatedAt,
        });
      } else if (existing[0].syncStatus === 'synced' && existing[0].updatedAt < remoteUpdatedAt) {
        await db.update(labels)
          .set(labelPatchFromRemote(remote))
          .where(and(eq(labels.id, remote.id), eq(labels.userId, userId)));
      }
    }

    // ── Events ───────────────────────────────────────────────────────────────
    const remoteEvents = await fetchRemoteEventChanges(since);
    nextLastSync = maxRemoteUpdatedAt(nextLastSync, remoteEvents);
    for (const remote of remoteEvents) {
      if (remote.user_id !== userId) continue;

      const remoteUpdatedAt = remoteTime(remote.updated_at);
      const existing = await db.select().from(events)
        .where(and(eq(events.id, remote.id), eq(events.userId, userId))).limit(1);

      if (remote.deleted_at) {
        if (
          existing.length > 0 &&
          (existing[0].syncStatus === 'synced' || existing[0].updatedAt <= remoteUpdatedAt)
        ) {
          await db.delete(events)
            .where(and(eq(events.id, remote.id), eq(events.userId, userId)));
        }
        continue;
      }

      if (existing.length === 0) {
        await db.insert(events).values({
          id: remote.id,
          userId: remote.user_id,
          ...eventPatchFromRemote(remote),
          syncStatus: 'synced',
        });
      } else if (existing[0].syncStatus === 'synced' && existing[0].updatedAt < remoteUpdatedAt) {
        await db.update(events).set({
          ...eventPatchFromRemote(remote),
        }).where(and(eq(events.id, remote.id), eq(events.userId, userId)));
      }
    }

    if (nextLastSync > since) {
      await setLastSync(userId, nextLastSync);
    }
  } catch (error) {
    console.warn('[sync] pull failed', error);
  }
}

export async function pollRemoteChanges(): Promise<void> {
  const now = Date.now();
  if (now - lastPullAttemptAt < 15000) return;
  lastPullAttemptAt = now;

  await pullChanges();
}

export async function syncAll(): Promise<void> {
  await pushChanges();
  await tryTriggerGoogleSyncNow();
  await pullChanges();
}
