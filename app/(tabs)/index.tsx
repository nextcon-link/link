import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
} from "react-native";
import {
  router,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DAYS,
  formatDate,
  getCurrentWeekKey,
  getWeekDates,
} from "../../utils/date";

import type { EventItem, EventsByWeek } from "../../utils/events";
import { loadEvents, saveEvents } from "../../utils/storage";

const HOUR_HEIGHT = 70;
const TIME_COLUMN_WIDTH = 44;

const SCREEN_WIDTH = Dimensions.get("window").width;
const DAY_WIDTH = (SCREEN_WIDTH - TIME_COLUMN_WIDTH - 24) / 7;

export default function HomeScreen() {
  const { week } = useLocalSearchParams();

  const weekKey = week ? String(week) : getCurrentWeekKey();
  const weekDates = getWeekDates(weekKey);

  const baseDate = weekDates[0];

  const [events, setEvents] = useState<EventItem[]>([]);

  const refreshEvents = async () => {
    const allEvents = await loadEvents();

    const currentWeekEvents = allEvents[weekKey] || {};

    setEvents(Object.values(currentWeekEvents));
  };

  useFocusEffect(
    useCallback(() => {
      refreshEvents();
    }, [weekKey])
  );

  const deleteEvent = async (id: string) => {
    const allEvents = await loadEvents();

    if (allEvents[weekKey]) {
      delete allEvents[weekKey][id];
    }

    await saveEvents(allEvents);
    refreshEvents();
  };

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

          {events.map((event) => {
            const eventDateIndex = weekDates.findIndex(
              (date) => formatDate(date) === event.date
            );

            if (eventDateIndex === -1) {
              return null;
            }

            const start = event.startHour + event.startMinute / 60;
            const end = event.endHour + event.endMinute / 60;

            return (
              <Pressable
                key={event.id}
                onPress={() => deleteEvent(event.id)}
                style={[
                  styles.eventBlock,
                  {
                    top: start * HOUR_HEIGHT,
                    height: (end - start) * HOUR_HEIGHT,
                    left: TIME_COLUMN_WIDTH + eventDateIndex * DAY_WIDTH,
                    width: DAY_WIDTH,
                  },
                ]}
              >
                <Text style={styles.eventText}>{event.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: "/add",
            params: { week: weekKey },
          })
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
  position: "absolute",   // ⭐ 추가
  left: 0,
  width: TIME_COLUMN_WIDTH,
  textAlign: "center",
  fontSize: 12,
  color: "#333333",
  },

  eventBlock: {
    position: "absolute",
    backgroundColor: "#4A90E2",
    padding: 4,
    borderRadius: 4,
  },

  eventText: {
    color: "white",
    fontSize: 12,
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