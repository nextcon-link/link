import { and, eq } from "drizzle-orm";

import { db } from "@/database";
import { sharedBundleEvents, sharedBundles } from "@/database/schema";
import { supabase } from "@/services/supabaseApi";
import type { FriendProfile } from "@/services/friendApi";

const FRIEND_BUNDLE_COLOR = "#6C8AE4";
const FRIEND_EVENT_COLOR = "#6C8AE4";

export type FriendScheduleEvent = {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  recurrenceRule: string | null;
  color: string;
};

type FriendScheduleRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  recurrence_rule: string | null;
  color: string | null;
};

function getFriendName(friend: Pick<FriendProfile, "display_name" | "username">) {
  return friend.display_name || friend.username || "친구";
}

export async function fetchFriendSchedule(input: {
  friendId: string;
  rangeStart: number;
  rangeEnd: number;
}): Promise<FriendScheduleEvent[]> {
  const { data, error } = await supabase.rpc("get_friend_shared_events", {
    p_friend_id: input.friendId,
    p_range_start: new Date(input.rangeStart).toISOString(),
    p_range_end: new Date(input.rangeEnd).toISOString(),
  });

  if (error) throw error;

  return ((data ?? []) as FriendScheduleRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    startTime: new Date(row.start_time).getTime(),
    endTime: new Date(row.end_time).getTime(),
    isAllDay: row.is_all_day,
    recurrenceRule: row.recurrence_rule,
    color: row.color || FRIEND_EVENT_COLOR,
  }));
}

export async function saveFriendScheduleBundle(input: {
  userId: string;
  friend: FriendProfile;
  weekKey: string;
  events: {
    title: string;
    startTime: number;
    endTime: number;
    isAllDay?: boolean;
  }[];
}) {
  if (!input.userId) return 0;

  const friendName = getFriendName(input.friend);
  const bundleId = `friend_${input.friend.id}_${input.weekKey}`;
  const now = Date.now();

  await db
    .delete(sharedBundles)
    .where(and(eq(sharedBundles.id, bundleId), eq(sharedBundles.userId, input.userId)));

  await db.insert(sharedBundles).values({
    id: bundleId,
    userId: input.userId,
    title: `${friendName}의 ${input.weekKey} 일정`,
    ownerName: friendName,
    color: FRIEND_BUNDLE_COLOR,
    expiresAt: null,
    isDemo: false,
    createdAt: now,
  });

  for (const [index, event] of input.events.entries()) {
    await db.insert(sharedBundleEvents).values({
      id: `${bundleId}_event_${index}`,
      bundleId,
      userId: input.userId,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      isAllDay: Boolean(event.isAllDay),
      createdAt: now,
    });
  }

  return input.events.length;
}
