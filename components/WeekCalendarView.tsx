import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import dayjs from "dayjs";

import { DAYS, formatDate, getWeekDates } from "@/utils/date";

const HOUR_HEIGHT = 70;
const TIME_COLUMN_WIDTH = 44;
const HORIZONTAL_PADDING = 24;

export type WeekCalendarEvent = {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  color: string;
  opacity?: number;
  source?: string;
  editable?: boolean;
};

type Props = {
  weekKey: string;
  events: WeekCalendarEvent[];
  emptyText?: string;
  onEventPress?: (event: WeekCalendarEvent) => void;
};

export default function WeekCalendarView({
  weekKey,
  events,
  emptyText,
  onEventPress,
}: Props) {
  const { width } = useWindowDimensions();
  const weekDates = getWeekDates(weekKey);
  const baseDate = weekDates[0];
  const dayWidth = (width - TIME_COLUMN_WIDTH - HORIZONTAL_PADDING) / 7;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {baseDate.getFullYear()}년 {baseDate.getMonth() + 1}월
      </Text>

      <View style={styles.headerRow}>
        <View style={{ width: TIME_COLUMN_WIDTH }} />
        {DAYS.map((day, i) => (
          <View key={day} style={[styles.dayHeader, { width: dayWidth }]}>
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

          {emptyText && events.length === 0 && (
            <View style={styles.emptyBox} pointerEvents="none">
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          )}

          {events.map((event) => {
            const startD = dayjs(event.startTime);
            const endD = dayjs(event.endTime);
            const eventDate = startD.format("YYYY-MM-DD");
            const eventDateIndex = weekDates.findIndex(
              (d) => formatDate(d) === eventDate,
            );
            if (eventDateIndex === -1) return null;

            const start = startD.hour() + startD.minute() / 60;
            const end = endD.hour() + endD.minute() / 60;

            return (
              <Pressable
                key={event.id}
                disabled={!onEventPress}
                onPress={() => onEventPress?.(event)}
                style={[
                  styles.eventBlock,
                  {
                    backgroundColor: event.color,
                    top: start * HOUR_HEIGHT,
                    height: Math.max((end - start) * HOUR_HEIGHT, 20),
                    left: TIME_COLUMN_WIDTH + eventDateIndex * dayWidth,
                    width: dayWidth,
                    opacity: event.opacity ?? 1,
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
  emptyBox: {
    position: "absolute",
    top: 140,
    left: TIME_COLUMN_WIDTH,
    right: 12,
    alignItems: "center",
    padding: 16,
  },
  emptyText: {
    color: "#777",
    fontSize: 14,
    textAlign: "center",
  },
});
