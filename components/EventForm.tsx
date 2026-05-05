import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DAYS, formatDate } from "../utils/date";
import type { LabelItem } from "../utils/events";
import { loadLabels } from "../utils/storage";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

export type EventFormValue = {
  title: string;
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  labelId: string | null;
};

type EventFormProps = {
  mode: "add" | "edit";
  titleText: string;
  weekDates: Date[];
  initialValue: EventFormValue;
  onSubmit: (value: EventFormValue) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

export default function EventForm({
  mode,
  titleText,
  weekDates,
  initialValue,
  onSubmit,
  onDelete,
}: EventFormProps) {
  const [title, setTitle] = useState(initialValue.title);
  const [selectedDate, setSelectedDate] = useState(initialValue.date);

  const [startHour, setStartHour] = useState(initialValue.startHour);
  const [startMinute, setStartMinute] = useState(initialValue.startMinute);
  const [endHour, setEndHour] = useState(initialValue.endHour);
  const [endMinute, setEndMinute] = useState(initialValue.endMinute);

  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(
    initialValue.labelId,
  );

  const [labels, setLabels] = useState<LabelItem[]>([]);

  const refreshLabels = async () => {
    const labelsById = await loadLabels();
    setLabels(Object.values(labelsById));
  };

  useFocusEffect(
    useCallback(() => {
      refreshLabels();
    }, []),
  );

  const submit = () => {
    onSubmit({
      title,
      date: selectedDate,
      startHour,
      startMinute,
      endHour,
      endMinute,
      labelId: selectedLabelId,
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{titleText}</Text>

      <Text style={styles.label}>일정 이름</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="예: 자료구조"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>라벨 선택</Text>
      <View style={styles.row}>
        <Pressable
          style={[
            styles.selectButton,
            selectedLabelId === null && styles.selectedButton,
          ]}
          onPress={() => setSelectedLabelId(null)}
        >
          <Text
            style={[
              styles.selectText,
              selectedLabelId === null && styles.selectedText,
            ]}
          >
            라벨 없음
          </Text>
        </Pressable>

        {labels.map((label) => {
          const selected = selectedLabelId === label.id;

          return (
            <Pressable
              key={label.id}
              style={[styles.selectButton, selected && styles.selectedButton]}
              onPress={() => setSelectedLabelId(label.id)}
            >
              <Text
                style={[styles.selectText, selected && styles.selectedText]}
              >
                {label.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>날짜 선택</Text>
      <View style={styles.row}>
        {weekDates.map((date, index) => {
          const dateString = formatDate(date);
          const selected = selectedDate === dateString;

          return (
            <Pressable
              key={dateString}
              style={[styles.selectButton, selected && styles.selectedButton]}
              onPress={() => setSelectedDate(dateString)}
            >
              <Text
                style={[styles.selectText, selected && styles.selectedText]}
              >
                {DAYS[index]} {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>시작 시간</Text>
      <ScrollView horizontal>
        {HOURS.map((hour) => {
          const selected = startHour === hour;

          return (
            <Pressable
              key={hour}
              style={[styles.timeButton, selected && styles.selectedButton]}
              onPress={() => setStartHour(hour)}
            >
              <Text
                style={[styles.selectText, selected && styles.selectedText]}
              >
                {hour}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>시작 분</Text>
      <View style={styles.row}>
        {MINUTES.map((minute) => {
          const selected = startMinute === minute;

          return (
            <Pressable
              key={minute}
              style={[styles.minuteButton, selected && styles.selectedButton]}
              onPress={() => setStartMinute(minute)}
            >
              <Text
                style={[styles.selectText, selected && styles.selectedText]}
              >
                {minute.toString().padStart(2, "0")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>종료 시간</Text>
      <ScrollView horizontal>
        {HOURS.map((hour) => {
          const selected = endHour === hour;

          return (
            <Pressable
              key={hour}
              style={[styles.timeButton, selected && styles.selectedButton]}
              onPress={() => setEndHour(hour)}
            >
              <Text
                style={[styles.selectText, selected && styles.selectedText]}
              >
                {hour}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>종료 분</Text>
      <View style={styles.row}>
        {MINUTES.map((minute) => {
          const selected = endMinute === minute;

          return (
            <Pressable
              key={minute}
              style={[styles.minuteButton, selected && styles.selectedButton]}
              onPress={() => setEndMinute(minute)}
            >
              <Text
                style={[styles.selectText, selected && styles.selectedText]}
              >
                {minute.toString().padStart(2, "0")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.saveButton} onPress={submit}>
        <Text style={styles.saveButtonText}>
          {mode === "add" ? "저장" : "수정 완료"}
        </Text>
      </Pressable>

      {mode === "edit" && onDelete && (
        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>일정 삭제</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 20,
    paddingTop: 60,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 20,
  },

  label: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginTop: 18,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#111",
  },

  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  selectButton: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },

  timeButton: {
    width: 44,
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginRight: 8,
    marginBottom: 6,
  },

  minuteButton: {
    width: 56,
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 6,
  },

  selectedButton: {
    backgroundColor: "#111",
    borderColor: "#111",
  },

  selectText: {
    color: "#111",
    fontSize: 14,
  },

  selectedText: {
    color: "#FFF",
    fontWeight: "bold",
  },

  saveButton: {
    marginTop: 30,
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  deleteButton: {
    marginTop: 14,
    marginBottom: 80,
    backgroundColor: "#D9534F",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  deleteButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
