import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import dayjs from "dayjs";

import { DAYS, formatDate, getCurrentWeekKey, getWeekDates } from "@/utils/date";
import { db } from "@/database";
import { events, labels } from "@/database/schema";
import { getMergedEvents, type MergedEvent, type EventWithLabel } from "@/services/deviceSync";
import { useAuthStore } from "@/store/auth";

const HOUR_HEIGHT = 70;
const TIME_COLUMN_WIDTH = 44;
const SCREEN_WIDTH = Dimensions.get("window").width;
const DAY_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH - 24) / 7;

export default function HomeScreen() {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const { week } = useLocalSearchParams();
  const weekKey = week ? String(week) : getCurrentWeekKey();
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const baseDate = weekDates[0];

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {baseDate.getFullYear()}년 {baseDate.getMonth() + 1}월
      </Text>

      <View style={styles.headerRow}>
        <View style={{ width: TIME_COLUMN_WIDTH }} />
        {DAYS.map((day, i) => (
          <View key={day} style={styles.dayHeader}>
            <Text>{day}</Text>
            <Text style={styles.dateText}>{weekDates[i].getDate()}</Text>
          </View>
        ))}
      </View>

      <ScrollView>
        <View style={styles.grid}>
          {Array.from({ length: 25 }).map((_, i) => (
            <React.Fragment key={i}>
              <View style={[styles.hourLine, { top: i * HOUR_HEIGHT }]} />
              {i < 24 && (
                <Text style={[styles.hourText, { top: i * HOUR_HEIGHT + 4 }]}>
                  {i.toString().padStart(2, "0")}
                </Text>
              )}
            </React.Fragment>
          ))}

          {mergedEvents.map((event) => {
            const startD = dayjs(event.startTime);
            const endD   = dayjs(event.endTime);
            const eventDate = startD.format("YYYY-MM-DD");
            const eventDateIndex = weekDates.findIndex(
              (d) => formatDate(d) === eventDate,
            );
            if (eventDateIndex === -1) return null;

            const start = startD.hour() + startD.minute() / 60;
            const end   = endD.hour()   + endD.minute()   / 60;

            return (
              <Pressable
                key={event.id}
                onPress={() => {
                  if (event.source === "device") return;
                  router.push({
                    pathname: "/edit",
                    params: { id: event.id, week: weekKey },
                  });
                }}
                style={[
                  styles.eventBlock,
                  {
                    backgroundColor: event.labelColor,
                    top: start * HOUR_HEIGHT,
                    height: Math.max((end - start) * HOUR_HEIGHT, 20),
                    left: TIME_COLUMN_WIDTH + eventDateIndex * DAY_WIDTH,
                    width: DAY_WIDTH,
                    opacity: event.source === "device" ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={styles.eventText} numberOfLines={2}>
                  {event.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 50,
  },
  title: {
    fontSize: 22,
    textAlign: "center",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayHeader: {
    width: DAY_WIDTH,
    alignItems: "center",
  },
  dateText: {
    fontSize: 12,
  },
  grid: {
    height: 24 * HOUR_HEIGHT,
    position: "relative",
  },
  hourLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#DDDDDD",
  },
  hourText: {
    position: "absolute",
    left: 0,
    width: TIME_COLUMN_WIDTH,
    textAlign: "center",
    fontSize: 12,
    color: "#333333",
  },
  eventBlock: {
    position: "absolute",
    padding: 4,
    borderRadius: 4,
  },
  eventText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
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
  buttonText: {
    color: "white",
  },
});
