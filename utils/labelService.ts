import { generateId } from "@/utils/uuid";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/database";
import { events, labels } from "@/database/schema";
import { pushChanges } from "@/services/syncEngine";
import { getCurrentUserId } from "@/utils/storage";
import type { LabelFormInput } from "@/utils/events";

export async function createLabel(input: LabelFormInput): Promise<void> {
  const userId = await getCurrentUserId();
  await db.insert(labels).values({
    id:         generateId(),
    userId,
    name:       input.name.trim(),
    color:      input.color,
    isVisible:  true,
    googleSyncEnabled: true,
    googleIsReadonly: false,
    syncStatus: "pending_create",
    updatedAt:  Date.now(),
  });
  pushChanges();
}

export async function updateLabel(
  id: string,
  input: LabelFormInput,
): Promise<void> {
  const userId = await getCurrentUserId();
  await db.update(labels).set({
    name:       input.name.trim(),
    color:      input.color,
    syncStatus: "pending_update",
    updatedAt:  Date.now(),
  }).where(and(eq(labels.id, id), eq(labels.userId, userId), isNull(labels.deletedAt)));
  pushChanges();
}

// Label deletes are soft-deleted for remote sync, so clear local event labels too.
export async function deleteLabel(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  const now = Date.now();
  await db.update(labels).set({
    syncStatus: "pending_delete",
    deletedAt:  now,
    updatedAt:  now,
  }).where(and(eq(labels.id, id), eq(labels.userId, userId), isNull(labels.deletedAt)));
  await db.update(events).set({
    labelId:    null,
    syncStatus: "pending_update",
    updatedAt:  now,
  }).where(and(eq(events.labelId, id), eq(events.userId, userId)));
  pushChanges();
}

export async function toggleLabelVisibility(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  const rows = await db
    .select()
    .from(labels)
    .where(and(eq(labels.id, id), eq(labels.userId, userId), isNull(labels.deletedAt)))
    .limit(1);
  if (rows.length === 0) return;
  await db.update(labels).set({
    isVisible:  !rows[0].isVisible,
    syncStatus: "pending_update",
    updatedAt:  Date.now(),
  }).where(and(eq(labels.id, id), eq(labels.userId, userId), isNull(labels.deletedAt)));
  pushChanges();
}
