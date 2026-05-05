import React, { useCallback, useState } from "react";
import {
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  router,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";

import {
  DAYS,
  formatDate,
  getCurrentWeekKey,
  getWeekDates,
  getWeekKey,
} from "../utils/date";

import type {
  EventItem,
  EventsByWeek,
  LabelItem,
  LabelsById,
} from "../utils/events";

import { loadEvents, saveEvents, loadLabels } from "../utils/storage";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

export default function AddScreen() {
  const { week } = useLocalSearchParams();

  const weekKey = week ? String(week) : getCurrentWeekKey();
  const weekDates = getWeekDates(weekKey);

  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatDate(weekDates[0]));

  const [startHour, setStartHour] = useState(10);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(11);
  const [endMinute, setEndMinute] = useState(0);

  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);

  const refreshLabels = async () => {
  const parsed = await loadLabels();
  setLabels(Object.values(parsed));
  };

  useFocusEffect(
    useCallback(() => {
      refreshLabels();
    }, [])
  );

  const saveEvent = async () => {
    // 제목이 비어 있으면 저장하지 않는다.
    if (!title.trim()) return;

    // 시간을 분 단위로 바꿔서 비교한다.
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    // 종료 시간이 시작 시간보다 빠르거나 같으면 저장하지 않는다.
    if (endTotal <= startTotal) return;

    const id = Date.now().toString();

    const newEvent: EventItem = {
      id,
      title: title.trim(),
      date: selectedDate,
      startHour,
      startMinute,
      endHour,
      endMinute,
      labelId: selectedLabelId,
    };

    // 선택 날짜가 포함된 주를 구한다.
    const eventWeekKey = getWeekKey(selectedDate);

    const allEvents = await loadEvents();

    // 해당 주의 기존 일정들만 가져온다.
    const weekEvents = allEvents[eventWeekKey] || {};

    // 같은 날짜에서 시간이 겹치는 일정이 있는지 검사한다.
    const hasOverlap = Object.values(weekEvents).some((event) => {
      if (event.date !== selectedDate) return false;

      const existingStart = event.startHour * 60 + event.startMinute;
      const existingEnd = event.endHour * 60 + event.endMinute;

      return startTotal < existingEnd && endTotal > existingStart;
    });

    // 겹치면 저장하지 않는다.
    if (hasOverlap) {
      console.log("이미 같은 시간대에 일정이 있습니다.");
      return;
    }

    // 해당 주 공간이 없으면 만든다.
    if (!allEvents[eventWeekKey]) {
      allEvents[eventWeekKey] = {};
    }

    // eventId를 key로 저장한다.
    allEvents[eventWeekKey][id] = newEvent;

    await saveEvents(allEvents);
    
    router.back();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>일정 추가</Text>

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
              <Text style={[styles.selectText, selected && styles.selectedText]}>
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
              <Text style={[styles.selectText, selected && styles.selectedText]}>
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
              <Text style={[styles.selectText, selected && styles.selectedText]}>
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
              <Text style={[styles.selectText, selected && styles.selectedText]}>
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
              <Text style={[styles.selectText, selected && styles.selectedText]}>
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
              <Text style={[styles.selectText, selected && styles.selectedText]}>
                {minute.toString().padStart(2, "0")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.saveButton} onPress={saveEvent}>
        <Text style={styles.saveButtonText}>저장</Text>
      </Pressable>
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
    marginBottom: 80,
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
});