import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import dayjs from "dayjs";

import WeekCalendarView, {
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
const STACKED_OPACITY = 0.55;

export default function SharedScreen() {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const weekKey = getCurrentWeekKey();
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const weekStart = dayjs(weekDates[0]).startOf("day").valueOf();
  const weekEnd = dayjs(weekDates[6]).endOf("day").valueOf();
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

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

  const isStacked = selectedSourceIds.length > 1;
  const eventOpacity = isStacked ? STACKED_OPACITY : 1;

  const calendarEvents: WeekCalendarEvent[] = useMemo(() => {
    if (selectedSourceIds.length === 0) return [];

    const selected = new Set(selectedSourceIds);
    const mine: WeekCalendarEvent[] = selected.has(MY_CALENDAR_ID)
      ? localRows
          .filter((row) => !row.label || row.label.isVisible)
          .map((row) => ({
            id: `mine:${row.event.id}`,
            title: row.event.title,
            startTime: row.event.startTime,
            endTime: row.event.endTime,
            color: row.label?.color ?? "#4A90E2",
            opacity: eventOpacity,
            source: MY_CALENDAR_ID,
            editable: false,
            layoutGroupId: MY_CALENDAR_ID,
          }))
      : [];

    const shared: WeekCalendarEvent[] = sharedRows
      .filter((row) => selected.has(row.bundle.id))
      .map((row) => ({
        id: `shared:${row.event.id}`,
        title: row.event.title,
        startTime: row.event.startTime,
        endTime: row.event.endTime,
        color: row.bundle.color,
        opacity: eventOpacity,
        source: row.bundle.id,
        editable: false,
        layoutGroupId: row.bundle.id,
      }));

    return [...mine, ...shared].sort((a, b) => a.startTime - b.startTime);
  }, [eventOpacity, localRows, selectedSourceIds, sharedRows]);

  const sources = useMemo(
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

  const toggleSource = (id: string) => {
    setSelectedSourceIds((current) =>
      current.includes(id)
        ? current.filter((sourceId) => sourceId !== id)
        : [...current, id],
    );
  };

  return (
    <View style={styles.container}>
      <WeekCalendarView
        weekKey={weekKey}
        events={calendarEvents}
        emptyText="표시할 일정 덩어리를 선택하세요."
      />

      <Pressable
        style={styles.pickerButton}
        onPress={() => setIsPickerOpen(true)}
      >
        <Text style={styles.pickerButtonText}>일정 선택</Text>
        <Text style={styles.pickerCountText}>{selectedSourceIds.length}</Text>
      </Pressable>

      <Modal
        animationType="slide"
        transparent
        visible={isPickerOpen}
        onRequestClose={() => setIsPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>일정 덩어리</Text>
              <Pressable onPress={() => setIsPickerOpen(false)}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            <ScrollView>
              {sources.map((source) => {
                const selected = selectedSourceIds.includes(source.id);
                return (
                  <Pressable
                    key={source.id}
                    style={styles.sourceRow}
                    onPress={() => toggleSource(source.id)}
                  >
                    <View
                      style={[
                        styles.sourceColor,
                        { backgroundColor: source.color },
                      ]}
                    />
                    <View style={styles.sourceTextBox}>
                      <Text style={styles.sourceTitle}>{source.title}</Text>
                      <Text style={styles.sourceSubtitle}>
                        {source.subtitle}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        selected && styles.checkboxSelected,
                      ]}
                    >
                      {selected && <Text style={styles.checkText}>✓</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  pickerButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111",
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  pickerButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pickerCountText: {
    minWidth: 22,
    overflow: "hidden",
    borderRadius: 11,
    backgroundColor: "#FFF",
    color: "#111",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "800",
  },
  closeText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingVertical: 14,
  },
  sourceColor: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  sourceTextBox: {
    flex: 1,
  },
  sourceTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
  },
  sourceSubtitle: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BBB",
    borderRadius: 13,
  },
  checkboxSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  checkText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
