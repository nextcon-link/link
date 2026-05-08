import React, { useEffect, useMemo } from "react";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, eq, gte, isNull, lte, ne } from "drizzle-orm";
import dayjs from "dayjs";

import SharedBundleViewer, {
  type SharedBundleSource,
} from "@/components/SharedBundleViewer";
import {
  type WeekCalendarEvent,
} from "@/components/WeekCalendarView";
import { db } from "@/database";
import {
  events,
  labels,
  sharedBundleEvents,
  sharedBundles,
} from "@/database/schema";
import { seedDemoSharedBundles } from "@/services/sharedDemoSeed";
import { useAuthStore } from "@/store/auth";
import { getCurrentWeekKey, getWeekDates } from "@/utils/date";

const MY_CALENDAR_ID = "mine";

export default function SharedScreen() {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const weekKey = getCurrentWeekKey();
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const weekStart = dayjs(weekDates[0]).startOf("day").valueOf();
  const weekEnd = dayjs(weekDates[6]).endOf("day").valueOf();

  useEffect(() => {
    seedDemoSharedBundles(userId);
  }, [userId]);

  const { data: bundleList = [] } = useLiveQuery(
    db
      .select()
      .from(sharedBundles)
      .where(eq(sharedBundles.userId, userId))
      .orderBy(sharedBundles.createdAt),
    [userId],
  );

  const { data: localRows = [] } = useLiveQuery(
    db
      .select({
        event: events,
        label: labels,
      })
      .from(events)
      .leftJoin(
        labels,
        and(eq(events.labelId, labels.id), eq(labels.userId, userId)),
      )
      .where(
        and(
          eq(events.userId, userId),
          gte(events.startTime, weekStart),
          lte(events.startTime, weekEnd),
          isNull(events.deletedAt),
          ne(events.syncStatus, "pending_delete"),
        ),
      ),
    [userId, weekStart, weekEnd],
  );

  const { data: sharedRows = [] } = useLiveQuery(
    db
      .select({
        bundle: sharedBundles,
        event: sharedBundleEvents,
      })
      .from(sharedBundleEvents)
      .innerJoin(
        sharedBundles,
        eq(sharedBundleEvents.bundleId, sharedBundles.id),
      )
      .where(
        and(
          eq(sharedBundleEvents.userId, userId),
          gte(sharedBundleEvents.startTime, weekStart),
          lte(sharedBundleEvents.startTime, weekEnd),
        ),
      ),
    [userId, weekStart, weekEnd],
  );

  const calendarEvents: WeekCalendarEvent[] = useMemo(() => {
    const mine: WeekCalendarEvent[] = localRows
      .filter((row) => !row.label || row.label.isVisible)
      .map((row) => ({
        id: `mine:${row.event.id}`,
        title: row.event.title,
        startTime: row.event.startTime,
        endTime: row.event.endTime,
        color: row.label?.color ?? "#4A90E2",
        source: MY_CALENDAR_ID,
        editable: false,
        layoutGroupId: MY_CALENDAR_ID,
      }));

    const shared: WeekCalendarEvent[] = sharedRows
      .map((row) => ({
        id: `shared:${row.event.id}`,
        title: row.event.title,
        startTime: row.event.startTime,
        endTime: row.event.endTime,
        color: row.bundle.color,
        source: row.bundle.id,
        editable: false,
        layoutGroupId: row.bundle.id,
      }));

    return [...mine, ...shared].sort((a, b) => a.startTime - b.startTime);
  }, [localRows, sharedRows]);

  const sources = useMemo<SharedBundleSource[]>(
    () => [
      {
        id: MY_CALENDAR_ID,
        title: "내 일정",
        subtitle: "내 로컬 캘린더",
        color: "#111111",
      },
      ...bundleList.map((bundle) => ({
        id: bundle.id,
        title: bundle.title,
        subtitle: bundle.ownerName,
        color: bundle.color,
      })),
    ],
    [bundleList],
  );

  return (
    <SharedBundleViewer
      weekKey={weekKey}
      sources={sources}
      events={calendarEvents}
    />
  );
}
