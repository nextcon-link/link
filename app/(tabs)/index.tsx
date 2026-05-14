import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, eq, gte, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import dayjs from "dayjs";

import WeekCalendarView, {
  type WeekCalendarEvent,
} from "@/components/WeekCalendarView";
import {
  addWeeks,
  formatDate,
  getCurrentWeekKey,
  getWeekDates,
  parseDate,
} from "@/utils/date";
import { db } from "@/database";
import { events, labels } from "@/database/schema";
import { getMergedEvents, type MergedEvent, type EventWithLabel } from "@/services/deviceSync";
import { allowCalendarEntry } from "@/store/calendarAccess";
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
      ).padStart(2, "0")}. ${String(selectedDate.getDate()).padStart(2, "0")}`,
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
  useFocusEffect(useCallback(() => {
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
  }, [localEvents, weekDates]));

  const calendarEvents: WeekCalendarEvent[] = useMemo(
    () =>
      mergedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        color: event.labelColor ?? "#DC143C",
        opacity: event.source === "device" ? 0.7 : 1,
        source: event.source,
        editable:
          event.source === "local"
            ? !event.isReadonly
            : Boolean(event.canModify && !event.isAllDay),
        deviceCalendarId: event.deviceCalendarId,
        editEventId: event.originalEventId ?? event.id,
        layoutGroupId: MAIN_CALENDAR_LAYOUT_GROUP_ID,
      })),
    [mergedEvents],
  );

  const moveWeek = (amount: number) => {
    router.replace({
      pathname: "/",
      params: { week: addWeeks(weekKey, amount) },
    });
  };

  const openMonthCalendar = () => {
    allowCalendarEntry("home");
    router.push({
      pathname: "/calendar",
      params: { source: "home", week: weekKey },
    });
  };

  const openAddEvent = () => {
    router.push({ pathname: "/add", params: { week: weekKey } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.dateButton}
          onPress={openMonthCalendar}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.dateButtonText}
          >
            {selectedDateLabel}
          </Text>
        </Pressable>

        <View style={styles.topActions}>
          <Pressable
            accessibilityLabel="라벨 추가"
            style={styles.iconButton}
            onPress={() => router.push("/labels")}
          >
            <MaterialCommunityIcons
              name="tag-plus-outline"
              size={28}
              color="#1B1B20"
            />
          </Pressable>
          <Pressable
            accessibilityLabel="친구"
            style={styles.iconButton}
            onPress={() => router.push("/friends")}
          >
            <MaterialCommunityIcons
              name="account-group"
              size={29}
              color="#1B1B20"
            />
          </Pressable>
          <Pressable
            accessibilityLabel="월간 캘린더"
            style={styles.iconButton}
            onPress={openMonthCalendar}
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={29}
              color="#1B1B20"
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.calendarShell}>
        <WeekCalendarView
          weekKey={weekKey}
          events={calendarEvents}
          onEventPress={(event) => {
            if (event.source === "device") {
              if (!event.editable) return;
              router.push({
                pathname: "/device-event",
                params: { id: event.editEventId ?? event.id, week: weekKey },
              });
              return;
            }

            if (event.editable) {
              router.push({
                pathname: "/edit",
                params: { id: event.editEventId ?? event.id, week: weekKey },
              });
            }
          }}
          onPreviousWeek={() => moveWeek(-1)}
          onNextWeek={() => moveWeek(1)}
        />
      </View>

      <Pressable
        accessibilityLabel="일정 추가"
        onPress={openAddEvent}
        style={styles.floatingAddButton}
      >
        <MaterialCommunityIcons name="plus" size={34} color="#FFFFFF" />
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
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 14,
    paddingLeft: 42,
    paddingRight: 28,
    paddingBottom: 18,
  },
  dateButton: {
    flex: 1,
    minWidth: 0,
  },
  dateButtonText: {
    color: "#05070A",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: 0,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 11,
    paddingBottom: 2,
  },
  iconButton: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarShell: {
    flex: 1,
  },
  floatingAddButton: {
    position: "absolute",
    right: 24,
    bottom: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC143C",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
  },
});
