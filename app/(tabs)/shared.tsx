import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import dayjs from "dayjs";

import SharedBundleViewer, {
  type GeneratedShareQr,
  type SharedBundleSource,
} from "@/components/SharedBundleViewer";
import type { WeekCalendarEvent } from "@/components/WeekCalendarView";
import { db } from "@/database";
import {
  events,
  labels,
  sharedBundleEvents,
  sharedBundles,
} from "@/database/schema";
import { seedDemoSharedBundles } from "@/services/sharedDemoSeed";
import {
  createSharedBundleLink,
  deleteSharedBundle,
  updateSharedBundleColor,
} from "@/services/sharedBundleService";
import { useAuthStore } from "@/store/auth";
import { addWeeks, getCurrentWeekKey, getWeekDates } from "@/utils/date";

const MY_CALENDAR_ID = "mine";
const MY_CALENDAR_COLOR = "#9FF4E2";

export default function SharedScreen() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? "";
  const [weekKey, setWeekKey] = useState(getCurrentWeekKey());
  const [qr, setQr] = useState<GeneratedShareQr | null>(null);
  const [isCreatingQr, setIsCreatingQr] = useState(false);
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const weekStart = dayjs(weekDates[0]).startOf("day").valueOf();
  const weekEnd = dayjs(weekDates[6]).endOf("day").valueOf();

  useEffect(() => {
    seedDemoSharedBundles();
  }, []);

  const { data: bundleList = [] } = useLiveQuery(
    db
      .select()
      .from(sharedBundles)
      .where(or(eq(sharedBundles.userId, userId), eq(sharedBundles.isDemo, true)))
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
        and(
          eq(events.labelId, labels.id),
          eq(labels.userId, userId),
          isNull(labels.deletedAt),
        ),
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
          or(
            eq(sharedBundleEvents.userId, userId),
            eq(sharedBundles.isDemo, true),
          ),
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
        isAllDay: row.event.isAllDay,
        color: MY_CALENDAR_COLOR,
        source: MY_CALENDAR_ID,
        editable: false,
        layoutGroupId: MY_CALENDAR_ID,
      }));

    const shared: WeekCalendarEvent[] = sharedRows.map((row) => ({
      id: `shared:${row.event.id}`,
      title: row.event.title,
      startTime: row.event.startTime,
      endTime: row.event.endTime,
      isAllDay: row.event.isAllDay,
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
        subtitle: "로컬 캘린더",
        color: MY_CALENDAR_COLOR,
        canDelete: false,
        canChangeColor: false,
      },
      ...bundleList.map((bundle) => ({
        id: bundle.id,
        title: bundle.title,
        subtitle: bundle.ownerName,
        color: bundle.color,
        canDelete: !bundle.isDemo,
        canChangeColor: true,
      })),
    ],
    [bundleList],
  );

  const createQr = async () => {
    if (!userId || !user) return;

    setIsCreatingQr(true);
    try {
      const result = await createSharedBundleLink({
        userId,
        user,
        weekKey,
        weekStart,
        weekEnd,
      });
      setQr(result);
    } catch {
      Alert.alert("QR 생성 실패", "일정 덩어리 QR을 만들 수 없어요.");
    } finally {
      setIsCreatingQr(false);
    }
  };

  const removeBundle = async (bundleId: string) => {
    await deleteSharedBundle(bundleId, userId);
  };

  const changeBundleColor = async (bundleId: string, color: string) => {
    await updateSharedBundleColor(bundleId, userId, color);
  };

  return (
    <SharedBundleViewer
      weekKey={weekKey}
      sources={sources}
      events={calendarEvents}
      generatedQr={qr}
      isCreatingQr={isCreatingQr}
      onCreateQr={createQr}
      onCloseQr={() => setQr(null)}
      onDeleteSource={removeBundle}
      onChangeSourceColor={changeBundleColor}
      onPreviousWeek={() => setWeekKey((current) => addWeeks(current, -1))}
      onNextWeek={() => setWeekKey((current) => addWeeks(current, 1))}
      onToday={() => setWeekKey(getCurrentWeekKey())}
    />
  );
}
