import { and, eq, isNull, ne } from "drizzle-orm";
import { Stack, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { db } from "@/database";
import type { Label } from "@/database/schema";
import { labels } from "@/database/schema";
import {
  getWritableDeviceCalendarOptions,
} from "@/services/deviceSync";
import type { DeviceCalendarOption } from "@/services/deviceCalendarSettings";
import { useAuthStore } from "@/store/auth";
import { DAYS, formatDate } from "@/utils/date";
import { sharingMode, type EventFormInput } from "@/utils/events";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

type VisibilityOption = { label: string, visibility: sharingMode }
const VISIBILITY_LEVEL: VisibilityOption[] = [
  {label:"없음",visibility:"none"},
  {label:"공개",visibility:"visible"},
  {label:"비공개",visibility:"invisible"},
  {label:"부분 공개",visibility:"blind"},
];

type RecurrenceOption = { label: string; rule: string | null };
const RECURRENCE_OPTIONS: RecurrenceOption[] = [
  { label: "없음",   rule: null },
  { label: "매일",   rule: "FREQ=DAILY" },
  { label: "매주",   rule: "FREQ=WEEKLY" },
  { label: "매월",   rule: "FREQ=MONTHLY" },
  { label: "매년",   rule: "FREQ=YEARLY" },
];

type Props = {
  mode: "add" | "edit";
  weekDates: Date[];
  initialValue: EventFormInput;
  onSubmit: (input: EventFormInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export default function EventForm({
  mode,
  weekDates,
  initialValue,
  onSubmit,
  onDelete,
}: Props) {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const [title, setTitle] = useState(initialValue.title);
  const [selectedDate, setSelectedDate] = useState(initialValue.date);
  const [startHour, setStartHour] = useState(initialValue.startHour);
  const [startMinute, setStartMinute] = useState(initialValue.startMinute);
  const [endHour, setEndHour] = useState(initialValue.endHour);
  const [endMinute, setEndMinute] = useState(initialValue.endMinute);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(
    initialValue.labelId,
  );
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(
    initialValue.recurrenceRule,
  );
  const [sharingMode, setSharingMode] = useState<sharingMode>(
    initialValue.sharingMode,
  );
  const [target, setTarget] = useState(initialValue.target);

  const [dbLabels, setDbLabels] = useState<Label[]>([]);
  const [deviceCalendars, setDeviceCalendars] = useState<DeviceCalendarOption[]>([]);
  const isEditingDeviceEvent =
    mode === "edit" && initialValue.target.type === "device";

  const refreshLabels = useCallback(async () => {
    if (!userId) {
      setDbLabels([]);
      return;
    }

    const rows = await db
      .select()
      .from(labels)
      .where(and(
        eq(labels.userId, userId),
        ne(labels.syncStatus, "pending_delete"),
        isNull(labels.deletedAt),
      ))
      .orderBy(labels.name);
    setDbLabels(rows);
  }, [userId]);

  const refreshDeviceCalendars = useCallback(async () => {
    if (mode !== "add" && !isEditingDeviceEvent) {
      setDeviceCalendars([]);
      return;
    }

    const rows = await getWritableDeviceCalendarOptions();
    if (isEditingDeviceEvent && initialValue.target.type === "device") {
      const currentDeviceCalendarId = initialValue.target.calendarId;
      setDeviceCalendars(
        rows.filter((calendar) => calendar.id === currentDeviceCalendarId),
      );
      return;
    }

    setDeviceCalendars(rows);
  }, [initialValue.target, isEditingDeviceEvent, mode]);

  useFocusEffect(
    useCallback(() => {
      refreshLabels();
      refreshDeviceCalendars();
    }, [refreshDeviceCalendars, refreshLabels]),
  );

  const handleSubmit = async () => {
    const isDeviceTarget = target.type === "device";
    await onSubmit({
      title,
      date: selectedDate,
      startHour,
      startMinute,
      endHour,
      endMinute,
      target,
      labelId: isDeviceTarget ? null : selectedLabelId,
      recurrenceRule: isDeviceTarget ? null : recurrenceRule,
      sharingMode: isDeviceTarget ? "none" : sharingMode,
    });
  };

  const headerTitle = mode === "add" ? "일정 추가" : "일정 편집";
  const headerRightLabel = mode === "add" ? "추가" : "적용";

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerRight: () => (
            <Pressable onPress={handleSubmit} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, styles.headerBtnPrimary]}>
                {headerRightLabel}
              </Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView style={styles.container}>
        {/* 이름 */}
        <Text style={styles.sectionLabel}>일정 이름</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="예: 자료구조"
          placeholderTextColor="#999"
        />

        {/* 라벨 */}
        <Text style={styles.sectionLabel}>라벨</Text>
        <View style={styles.row}>
          {!isEditingDeviceEvent && (
            <>
              <Pressable
                style={[
                  styles.chip,
                  target.type === "local" &&
                    selectedLabelId === null &&
                    styles.chipSelected,
                ]}
                onPress={() => {
                  setTarget({ type: "local" });
                  setSelectedLabelId(null);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    target.type === "local" &&
                      selectedLabelId === null &&
                      styles.chipTextSelected,
                  ]}
                >
                  없음
                </Text>
              </Pressable>
              {dbLabels.map((lbl) => {
                const selected =
                  target.type === "local" && selectedLabelId === lbl.id;
                const disabled = lbl.googleIsReadonly;
                return (
                  <Pressable
                    key={lbl.id}
                    disabled={disabled}
                    style={[
                      styles.chip,
                      selected && styles.chipSelected,
                      disabled && styles.chipDisabled,
                    ]}
                    onPress={() => {
                      setTarget({ type: "local" });
                      setSelectedLabelId(lbl.id);
                    }}
                  >
                    <View style={[styles.colorDot, { backgroundColor: lbl.color }]} />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {lbl.name}{disabled ? " 읽기전용" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
          {deviceCalendars.map((calendar) => {
            const selected =
              target.type === "device" && target.calendarId === calendar.id;
            return (
              <Pressable
                key={calendar.id}
                disabled={isEditingDeviceEvent}
                style={[
                  styles.chip,
                  selected && styles.chipSelected,
                  isEditingDeviceEvent && styles.chipDisabled,
                ]}
                onPress={() => {
                  setTarget({ type: "device", calendarId: calendar.id });
                  setSelectedLabelId(null);
                }}
              >
                <View
                  style={[styles.colorDot, { backgroundColor: calendar.color }]}
                />
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {calendar.title} 기기
                </Text>
              </Pressable>
            );
          })}
          {isEditingDeviceEvent && deviceCalendars.length === 0 && (
            <View style={[styles.chip, styles.chipSelected]}>
              <Text style={[styles.chipText, styles.chipTextSelected]}>
                기기 캘린더
              </Text>
            </View>
          )}
        </View>

        {/* 날짜 */}
        <Text style={styles.sectionLabel}>날짜</Text>
        <View style={styles.row}>
          {weekDates.map((date, index) => {
            const dateString = formatDate(date);
            const selected = selectedDate === dateString;
            return (
              <Pressable
                key={dateString}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setSelectedDate(dateString)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {DAYS[index]} {date.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 시작 시간 */}
        <Text style={styles.sectionLabel}>시작</Text>
        <View style={styles.timeRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {HOURS.map((hour) => {
              const selected = startHour === hour;
              return (
                <Pressable
                  key={hour}
                  style={[styles.timeChip, selected && styles.chipSelected]}
                  onPress={() => setStartHour(hour)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {hour}시
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.minuteGroup}>
            {MINUTES.map((minute) => {
              const selected = startMinute === minute;
              return (
                <Pressable
                  key={minute}
                  style={[styles.minuteChip, selected && styles.chipSelected]}
                  onPress={() => setStartMinute(minute)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {minute.toString().padStart(2, "0")}분
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 종료 시간 */}
        <Text style={styles.sectionLabel}>종료</Text>
        <View style={styles.timeRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {HOURS.map((hour) => {
              const selected = endHour === hour;
              return (
                <Pressable
                  key={hour}
                  style={[styles.timeChip, selected && styles.chipSelected]}
                  onPress={() => setEndHour(hour)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {hour}시
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.minuteGroup}>
            {MINUTES.map((minute) => {
              const selected = endMinute === minute;
              return (
                <Pressable
                  key={minute}
                  style={[styles.minuteChip, selected && styles.chipSelected]}
                  onPress={() => setEndMinute(minute)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {minute.toString().padStart(2, "0")}분
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 공개여부 설정 */}
        {target.type === "local" && (
          <>
            {/* 공개여부 설정 */}
            <Text style={styles.sectionLabel}>노출도 설정</Text>
            <View style={styles.row}>
              {VISIBILITY_LEVEL.map((opt) => {
                const selected = sharingMode === opt.visibility;
                return (
                  <Pressable
                    key={opt.label}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSharingMode(opt.visibility)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 반복 */}
            <Text style={styles.sectionLabel}>반복</Text>
            <View style={styles.row}>
              {RECURRENCE_OPTIONS.map((opt) => {
                const selected = recurrenceRule === opt.rule;
                return (
                  <Pressable
                    key={opt.label}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setRecurrenceRule(opt.rule)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* 삭제 (편집 모드만) */}
        {onDelete && (
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>일정 삭제</Text>
          </Pressable>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
  },
  headerBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  headerBtnText: {
    fontSize: 16,
    color: "#666",
  },
  headerBtnPrimary: {
    fontWeight: "700",
    color: "#111",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    marginTop: 20,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#111",
    backgroundColor: "#FAFAFA",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 13,
    backgroundColor: "#FAFAFA",
  },
  chipSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontSize: 14,
    color: "#333",
  },
  chipTextSelected: {
    color: "#FFF",
    fontWeight: "600",
  },
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  timeRow: {
    gap: 8,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginRight: 6,
    backgroundColor: "#FAFAFA",
  },
  minuteGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  minuteChip: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#FAFAFA",
  },
  deleteButton: {
    marginTop: 32,
    backgroundColor: "#D9534F",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
