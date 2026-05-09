import { generateId } from "@/utils/uuid";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/database";
import { events, labels } from "@/database/schema";
import { pushChanges } from "@/services/syncEngine";
import { toUtcMs } from "@/utils/datetime";
import { getCurrentUserId } from "@/utils/storage";
import type { EventFormInput } from "@/utils/events";

async function canWriteToLabel(
  userId: string,
  labelId: string | null,
): Promise<boolean> {
  if (!labelId) return true;

  const rows = await db
    .select({ googleIsReadonly: labels.googleIsReadonly })
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.userId, userId), isNull(labels.deletedAt)))
    .limit(1);

  return rows.length > 0 && !rows[0].googleIsReadonly;
}

// Flow A — optimistic write to local DB, then background sync to Supabase.
// Returns false if validation fails (empty title or bad times).
export async function createEvent(input: EventFormInput): Promise<boolean> {
  const { title, date, startHour, startMinute, endHour, endMinute, labelId, recurrenceRule } = input;

  if (!title.trim()) return false;

  const startUtc = toUtcMs(date, startHour, startMinute);
  const endUtc   = toUtcMs(date, endHour, endMinute);
  if (endUtc <= startUtc) return false;

  const userId = await getCurrentUserId();
  if (!(await canWriteToLabel(userId, labelId))) return false;

  await db.insert(events).values({
    id:         generateId(),
    userId,
    title:      title.trim(),
    startTime:  startUtc,
    endTime:    endUtc,
    isAllDay:       false,
    labelId,
    recurrenceRule: recurrenceRule ?? null,
    deletedAt:      null,
    syncStatus:     "pending_create",
    updatedAt:  Date.now(),
  });

  pushChanges();
  return true;
}

export async function updateEvent(
  id: string,
  input: EventFormInput,
): Promise<boolean> {
  const { title, date, startHour, startMinute, endHour, endMinute, labelId, recurrenceRule } = input;

  if (!title.trim()) return false;

  const startUtc = toUtcMs(date, startHour, startMinute);
  const endUtc   = toUtcMs(date, endHour, endMinute);
  if (endUtc <= startUtc) return false;

  const userId = await getCurrentUserId();
  if (!(await canWriteToLabel(userId, labelId))) return false;

  await db.update(events).set({
    title:      title.trim(),
    startTime:  startUtc,
    endTime:    endUtc,
    labelId,
    recurrenceRule: recurrenceRule ?? null,
    deletedAt:      null,
    syncStatus:     "pending_update",
    updatedAt:  Date.now(),
  }).where(and(eq(events.id, id), eq(events.userId, userId)));

  pushChanges();
  return true;
}

// Soft delete — sync engine will hard-delete from Supabase then remove locally.
export async function deleteEvent(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  await db.update(events).set({
    syncStatus: "pending_delete",
    deletedAt:  Date.now(),
    updatedAt:  Date.now(),
  }).where(and(eq(events.id, id), eq(events.userId, userId)));

  pushChanges();
}
