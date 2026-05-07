import { router, useLocalSearchParams, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import dayjs from "dayjs";

import WeekCalendarView, {
  type WeekCalendarEvent,
} from "@/components/WeekCalendarView";
import { getCurrentWeekKey, getWeekDates } from "@/utils/date";
import { db } from "@/database";
import { events, labels } from "@/database/schema";
import { getMergedEvents, type MergedEvent, type EventWithLabel } from "@/services/deviceSync";
import { useAuthStore } from "@/store/auth";

const MAIN_CALENDAR_LAYOUT_GROUP_ID = "main-calendar";

export default function HomeScreen() {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const { week } = useLocalSearchParams();
  const weekKey = week ? String(week) : getCurrentWeekKey();
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);

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
        and(eq(events.labelId, labels.id), eq(labels.userId, userId)),
      )
      .where(
        and(
          eq(events.userId, userId),
          gte(events.startTime, weekStart),
          lte(events.startTime, weekEnd),
          ne(events.syncStatus, "pending_delete"),
        ),
      ),
    [weekStart, weekEnd, userId],
  );

  const localEvents: EventWithLabel[] = useMemo(
    () =>
      rows
        .filter((row) => !row.label || row.label.isVisible)
        .map((row) => ({
          ...row.event,
          label: row.label ?? null,
        })),
    [rows],
  );

  const [mergedEvents, setMergedEvents] = useState<MergedEvent[]>([]);

  // Flow C — merge device calendar events in memory whenever local events change
  useEffect(() => {
    getMergedEvents(localEvents, weekDates[0], weekDates[6]).then(
      setMergedEvents,
    );
  }, [localEvents, weekDates]);

  const calendarEvents: WeekCalendarEvent[] = useMemo(
    () =>
      mergedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        color: event.labelColor,
        opacity: event.source === "device" ? 0.7 : 1,
        source: event.source,
        editable: event.source === "local",
        layoutGroupId: MAIN_CALENDAR_LAYOUT_GROUP_ID,
      })),
    [mergedEvents],
  );

  return (
    <View style={styles.container}>
      <WeekCalendarView
        weekKey={weekKey}
        events={calendarEvents}
        onEventPress={(event) => {
          if (!event.editable) return;
          router.push({
            pathname: "/edit",
            params: { id: event.id, week: weekKey },
          });
        }}
      />

      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push({ pathname: "/add", params: { week: weekKey } })
        }
      >
        <Text style={styles.buttonText}>+</Text>
      </Pressable>

      <Pressable
        style={styles.calendarBtn}
        onPress={() => router.push("/calendar")}
      >
        <Text style={styles.buttonText}>달력</Text>
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
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "black",
    padding: 15,
    borderRadius: 50,
  },
  calendarBtn: {
    position: "absolute",
    bottom: 30,
    left: 20,
    backgroundColor: "black",
    padding: 10,
  },
  labelBtn: {
    position: "absolute",
    bottom: 30,
    left: 75,
    backgroundColor: "black",
    padding: 10,
  },
  friendBtn: {
    position: "absolute",
    bottom: 30,
    left: 130,
    backgroundColor: "black",
    padding: 10,
  },
  buttonText: {
    color: "white",
  },
});
