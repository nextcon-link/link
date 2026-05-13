import { and, eq, isNull, ne } from "drizzle-orm";
import { router, Stack, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { db } from "@/database";
import type { Label } from "@/database/schema";
import { labels } from "@/database/schema";
import {
  getWritableDeviceCalendarOptions,
} from "@/services/deviceSync";
import type { DeviceCalendarOption } from "@/services/deviceCalendarSettings";
import { useAuthStore } from "@/store/auth";
import { DAYS, formatDate } from "@/utils/date";
import type { EventFormInput, sharingMode } from "@/utils/events";

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

function formatTime(hour: number, minute: number) {
  const suffix = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

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
  const [expandedTimeField, setExpandedTimeField] = useState<
    "start" | "end" | null
  >(null);

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
  const submitLabel = mode === "add" ? "추가" : "저장";
  const timeOptions =
    expandedTimeField === "start"
      ? { hour: startHour, minute: startMinute, setHour: setStartHour, setMinute: setStartMinute }
      : { hour: endHour, minute: endMinute, setHour: setEndHour, setMinute: setEndMinute };

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTitleStyle: styles.headerTitle,
        }}
      />

      <View style={styles.screen}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>일정 이름</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="예: 자료구조"
            placeholderTextColor="#A8A8A8"
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>라벨</Text>
            <Pressable
              accessibilityLabel="라벨 관리"
              hitSlop={8}
              style={styles.iconButton}
              onPress={() => router.push("/labels")}
            >
              <MaterialCommunityIcons name="cog" size={23} color="#111111" />
            </Pressable>
          </View>
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
                      <View
                        style={[styles.colorDot, { backgroundColor: lbl.color }]}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                        numberOfLines={1}
                      >
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
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                    numberOfLines={1}
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

          <Text style={styles.sectionLabel}>날짜</Text>
          <View style={styles.dateGrid}>
            {weekDates.map((date, index) => {
              const dateString = formatDate(date);
              const selected = selectedDate === dateString;
              return (
                <Pressable
                  key={dateString}
                  style={[styles.dateChip, selected && styles.chipSelected]}
                  onPress={() => setSelectedDate(dateString)}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {DAYS[index]} {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>시간</Text>
          <View style={styles.timeSummary}>
            <Pressable
              style={styles.timeSummaryButton}
              onPress={() =>
                setExpandedTimeField(
                  expandedTimeField === "start" ? null : "start",
                )
              }
            >
              <Text style={styles.timeSummaryText}>
                {formatTime(startHour, startMinute)}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color="#333333" />
            </Pressable>
            <MaterialCommunityIcons name="arrow-right" size={26} color="#111111" />
            <Pressable
              style={styles.timeSummaryButton}
              onPress={() =>
                setExpandedTimeField(expandedTimeField === "end" ? null : "end")
              }
            >
              <Text style={styles.timeSummaryText}>
                {formatTime(endHour, endMinute)}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color="#333333" />
            </Pressable>
          </View>

          {expandedTimeField && (
            <View style={styles.timePanel}>
              <Text style={styles.inlineLabel}>
                {expandedTimeField === "start" ? "시작 시간" : "종료 시간"}
              </Text>
              <View style={styles.timeChipGrid}>
                {HOURS.map((hour) => {
                  const selected = timeOptions.hour === hour;
                  return (
                    <Pressable
                      key={hour}
                      style={[styles.timeChip, selected && styles.chipSelected]}
                      onPress={() => timeOptions.setHour(hour)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {hour}시
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.minuteGroup}>
                {MINUTES.map((minute) => {
                  const selected = timeOptions.minute === minute;
                  return (
                    <Pressable
                      key={minute}
                      style={[styles.minuteChip, selected && styles.chipSelected]}
                      onPress={() => timeOptions.setMinute(minute)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {minute.toString().padStart(2, "0")}분
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {target.type === "local" && (
            <>
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
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

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
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {onDelete && (
            <Pressable style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>일정 삭제</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.saveButton} onPress={handleSubmit}>
            <Text style={styles.saveButtonText}>{submitLabel}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111111",
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DADADA",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: "#111111",
    backgroundColor: "#F8F8F8",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
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
    borderColor: "#D7D2DD",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    minHeight: 36,
    maxWidth: 190,
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
    color: "#333333",
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
  dateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dateChip: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D7D2DD",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    height: 36,
    minWidth: 50,
    paddingHorizontal: 10,
  },
  dateChipText: {
    fontSize: 14,
    color: "#333333",
    fontWeight: "500",
  },
  timeSummary: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: "#DADADA",
    borderRadius: 4,
    backgroundColor: "#F8F8F8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  timeSummaryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  timeSummaryText: {
    fontSize: 20,
    color: "#111111",
    fontWeight: "500",
  },
  timePanel: {
    borderWidth: 1,
    borderColor: "#E3E0E6",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  inlineLabel: {
    fontSize: 13,
    color: "#777777",
    fontWeight: "600",
  },
  timeChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: "#D7D2DD",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  minuteGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  minuteChip: {
    borderWidth: 1,
    borderColor: "#D7D2DD",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  deleteButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#D9534F",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#D9534F",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  saveButton: {
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: "#98493F",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
