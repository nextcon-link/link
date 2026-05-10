import { router, useLocalSearchParams, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, eq, gte, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import dayjs from "dayjs";

import WeekCalendarView, {
  type WeekCalendarEvent,
} from "@/components/WeekCalendarView";
import {
  formatDate,
  getCurrentWeekKey,
  getWeekDates,
  parseDate,
} from "@/utils/date";
import { db } from "@/database";
import { events, labels } from "@/database/schema";
import { getMergedEvents, type MergedEvent, type EventWithLabel } from "@/services/deviceSync";
import { useAuthStore } from "@/store/auth";

const MAIN_CALENDAR_LAYOUT_GROUP_ID = "main-calendar";

export default function HomeScreen() {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const { date, week } = useLocalSearchParams();
  const weekKey = week ? String(week) : getCurrentWeekKey();
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const selectedDate = useMemo(() => {
    const routeDate = typeof date === "string" ? parseDate(date) : null;
    const routeDateKey = routeDate ? formatDate(routeDate) : "";
    const isRouteDateInWeek = weekDates.some(
      (weekDate) => formatDate(weekDate) === routeDateKey,
    );

    if (routeDate && isRouteDateInWeek) return routeDate;

    const today = new Date();
    const todayKey = formatDate(today);
    const isTodayInWeek = weekDates.some(
      (weekDate) => formatDate(weekDate) === todayKey,
    );

    return isTodayInWeek ? today : weekDates[0];
  }, [date, weekDates]);
  const selectedDateLabel = useMemo(
    () =>
      `${selectedDate.getFullYear()}. ${String(
        selectedDate.getMonth() + 1,
      ).padStart(2, "0")}. ${String(selectedDate.getDate()).padStart(2, "0")}.`,
    [selectedDate],
  );

  const weekStart = dayjs(weekDates[0]).startOf("day").valueOf();
  const weekEnd   = dayjs(weekDates[6]).endOf("day").valueOf();

  // Reactive query: events LEFT JOIN labels, filtered by week + not deleted
  const { data: rows = [] } = useLiveQuery(
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
          or(
            and(gte(events.startTime, weekStart), lte(events.startTime, weekEnd)),
            and(isNotNull(events.recurrenceRule), lte(events.startTime, weekEnd)),
          ),
          isNull(events.deletedAt),
          ne(events.syncStatus, "pending_delete"),
        ),
      ),
    [weekStart, weekEnd, userId],
  );

  const { data: labelRows = [] } = useLiveQuery(
    db
      .select()
      .from(labels)
      .where(and(
        eq(labels.userId, userId),
        isNull(labels.deletedAt),
        ne(labels.syncStatus, "pending_delete"),
      )),
    [userId],
  );

  const labelsById = useMemo(
    () => new Map(labelRows.map((label) => [label.id, label])),
    [labelRows],
  );

  const localEvents: EventWithLabel[] = useMemo(
    () =>
      rows
        .map((row) => ({
          event: row.event,
          label: row.event.labelId
            ? labelsById.get(row.event.labelId) ?? row.label ?? null
            : null,
        }))
        .filter((row) => !row.label || row.label.isVisible)
        .map((row) => ({
          ...row.event,
          label: row.label,
        })),
    [labelsById, rows],
  );

  const [mergedEvents, setMergedEvents] = useState<MergedEvent[]>([]);

  // Flow C — merge device calendar events in memory whenever local events change
  useEffect(() => {
    let cancelled = false;

    getMergedEvents(localEvents, weekDates[0], weekDates[6]).then(
      (nextEvents) => {
        if (!cancelled) {
          setMergedEvents(nextEvents);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [localEvents, weekDates]);

  const calendarEvents: WeekCalendarEvent[] = useMemo(
    () =>
      mergedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        color: event.labelColor ?? "#9FF4E2",
        opacity: event.source === "device" ? 0.7 : 1,
        source: event.source,
        editable: event.source === "local" && !event.isReadonly,
        editEventId: event.originalEventId ?? event.id,
        layoutGroupId: MAIN_CALENDAR_LAYOUT_GROUP_ID,
      })),
    [mergedEvents],
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.dateButton}
          onPress={() => router.push("/calendar")}
        >
          <Text style={styles.dateButtonText}>{selectedDateLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.calendarShell}>
        <WeekCalendarView
          weekKey={weekKey}
          events={calendarEvents}
          onEventPress={(event) => {
            if (!event.editable) return;
            router.push({
              pathname: "/edit",
              params: { id: event.editEventId ?? event.id, week: weekKey },
            });
          }}
        />
      </View>

      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push({ pathname: "/add", params: { week: weekKey } })
        }
      >
        <Text style={styles.buttonText}>+</Text>
      </Pressable>

      <Pressable
        style={styles.labelBtn}
        onPress={() => router.push("/labels")}
      >
        <Text style={styles.buttonText}>라벨</Text>
      </Pressable>
      <Pressable
        style={styles.friendBtn}
        onPress={() => router.push("/friends" as Href)}
      >
        <Text style={styles.buttonText}>친구</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    height: 116,
    justifyContent: "flex-end",
    paddingHorizontal: 52,
    paddingBottom: 18,
  },
  dateButton: {
    alignSelf: "flex-start",
  },
  dateButtonText: {
    color: "#05070A",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: 0,
  },
  calendarShell: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "black",
    padding: 15,
    borderRadius: 50,
  },
  labelBtn: {
    position: "absolute",
    bottom: 30,
    left: 20,
    backgroundColor: "black",
    padding: 10,
  },
  friendBtn: {
    position: "absolute",
    bottom: 30,
    left: 75,
    backgroundColor: "black",
    padding: 10,
  },
  buttonText: {
    color: "white",
  },
});
