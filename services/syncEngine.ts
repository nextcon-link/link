import AsyncStorage from '@react-native-async-storage/async-storage';
import { ne, eq, and } from 'drizzle-orm';
import { db } from '../database';
import { labels, events } from '../database/schema';
import {
  pushLabels, pushEvents,
  deleteLabels, deleteEvents,
  fetchRemoteLabelChanges, fetchRemoteEventChanges,
  triggerGoogleSyncNow,
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

async function tryTriggerGoogleSyncNow(): Promise<void> {
  const now = Date.now();
  if (now - lastGoogleSyncAttemptAt < 5000) return;
  lastGoogleSyncAttemptAt = now;

  try {
    await triggerGoogleSyncNow();
  } catch {
    // Google sync is best-effort; Supabase remains the retry queue.
  }
}

// Flow B — push current user's pending local records to Supabase.
// Fails silently when offline.
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
      const syncedIds = await pushLabels(labelsToUpsert);
      didPushRemoteChanges = syncedIds.size > 0;
      for (const label of labelsToUpsert) {
        if (syncedIds.has(label.id)) {
          await db.update(labels)
            .set({ syncStatus: 'synced' })
            .where(and(eq(labels.id, label.id), eq(labels.userId, userId)));
        }
      }
    }
    if (labelsToDelete.length > 0) {
      await deleteLabels(labelsToDelete.map(l => l.id));
      didPushRemoteChanges = true;
      for (const label of labelsToDelete) {
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
      const syncedIds = await pushEvents(eventsToUpsert);
      didPushRemoteChanges = didPushRemoteChanges || syncedIds.size > 0;
      for (const event of eventsToUpsert) {
        if (syncedIds.has(event.id)) {
          await db.update(events)
            .set({ syncStatus: 'synced' })
            .where(and(eq(events.id, event.id), eq(events.userId, userId)));
        }
      }
    }
    if (eventsToDelete.length > 0) {
      await deleteEvents(eventsToDelete.map(e => e.id));
      didPushRemoteChanges = true;
      for (const event of eventsToDelete) {
        await db.delete(events)
          .where(and(eq(events.id, event.id), eq(events.userId, userId)));
      }
    }

    if (didPushRemoteChanges) {
      await tryTriggerGoogleSyncNow();
    }
  } catch {
    // Fail silently — retried on next pushChanges() call
  }
}

// Pull remote changes since last sync. Server wins for 'synced' local records only.
export async function pullChanges(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const since = await getLastSync(userId);
    const now = Date.now();

    // ── Labels (pull first — events FK depends on labels) ───────────────────
    const remoteLabels = await fetchRemoteLabelChanges(since);
    for (const remote of remoteLabels) {
      if (remote.user_id !== userId) continue;

      const remoteUpdatedAt = new Date(remote.updated_at).getTime();
      const existing = await db.select().from(labels)
        .where(and(eq(labels.id, remote.id), eq(labels.userId, userId))).limit(1);

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
          syncStatus: 'synced',
          updatedAt: remoteUpdatedAt,
        });
      } else if (existing[0].syncStatus === 'synced' && existing[0].updatedAt < remoteUpdatedAt) {
        await db.update(labels)
          .set({
            name: remote.name,
            color: remote.color,
            isVisible: remote.is_visible,
            googleCalendarId: remote.google_calendar_id,
            googleAccessRole: remote.google_access_role,
            googleSyncEnabled: remote.google_sync_enabled,
            googleIsReadonly: remote.google_is_readonly,
            updatedAt: remoteUpdatedAt,
          })
          .where(and(eq(labels.id, remote.id), eq(labels.userId, userId)));
      }
    }

    // ── Events ───────────────────────────────────────────────────────────────
    const remoteEvents = await fetchRemoteEventChanges(since);
    for (const remote of remoteEvents) {
      if (remote.user_id !== userId) continue;

      const remoteUpdatedAt = new Date(remote.updated_at).getTime();
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
          title: remote.title,
          startTime: new Date(remote.start_time).getTime(),
          endTime: new Date(remote.end_time).getTime(),
          isAllDay: remote.is_all_day,
          labelId: remote.label_id,
          recurrenceRule: remote.recurrence_rule,
          recurringEventId: remote.recurring_event_id,
          originalStartTime: remote.original_start_time
            ? new Date(remote.original_start_time).getTime() : null,
          googleEventId: remote.google_event_id,
          googleCalendarId: remote.google_calendar_id,
          googleEtag: remote.google_etag,
          googleUpdatedAt: remote.google_updated_at
            ? new Date(remote.google_updated_at).getTime() : null,
          deletedAt: null,
          syncStatus: 'synced',
          updatedAt: remoteUpdatedAt,
        });
      } else if (existing[0].syncStatus === 'synced' && existing[0].updatedAt < remoteUpdatedAt) {
        await db.update(events).set({
          title: remote.title,
          startTime: new Date(remote.start_time).getTime(),
          endTime: new Date(remote.end_time).getTime(),
          isAllDay: remote.is_all_day,
          labelId: remote.label_id,
          recurrenceRule: remote.recurrence_rule,
          recurringEventId: remote.recurring_event_id,
          originalStartTime: remote.original_start_time
            ? new Date(remote.original_start_time).getTime() : null,
          googleEventId: remote.google_event_id,
          googleCalendarId: remote.google_calendar_id,
          googleEtag: remote.google_etag,
          googleUpdatedAt: remote.google_updated_at
            ? new Date(remote.google_updated_at).getTime() : null,
          deletedAt: null,
          updatedAt: remoteUpdatedAt,
        }).where(and(eq(events.id, remote.id), eq(events.userId, userId)));
      }
    }

    await setLastSync(userId, now);
  } catch {
    // Fail silently
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
