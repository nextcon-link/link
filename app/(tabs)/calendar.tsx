import React, { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";

import {
  clearCalendarEntry,
  getCalendarEntrySource,
  type CalendarEntrySource,
} from "@/store/calendarAccess";
import { getWeekKey } from "@/utils/date";

export default function CalendarScreen() {
  const { source, week } = useLocalSearchParams<{
    source?: CalendarEntrySource;
    week?: string;
  }>();
  const entrySource =
    source === "home" || source === "shared" ? source : null;
  const canAccessCalendar =
    entrySource !== null && getCalendarEntrySource() === entrySource;

  useEffect(() => {
    if (canAccessCalendar) return;

    router.replace(entrySource === "shared" ? "/shared" : "/");
  }, [canAccessCalendar, entrySource]);

  if (!canAccessCalendar) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>주 선택</Text>

      <Calendar
        current={week}
        monthFormat="yyyy년 MM월"
        hideArrows={false}
        enableSwipeMonths={true}
        onDayPress={(day) => {
          const selectedWeek = getWeekKey(day.dateString);

          clearCalendarEntry();
          router.replace({
            pathname: entrySource === "shared" ? "/shared" : "/",
            params: { week: selectedWeek, date: day.dateString },
          });
        }}
        theme={{
          backgroundColor: "#FFFFFF",
          calendarBackground: "#FFFFFF",
          textSectionTitleColor: "#111111",
          monthTextColor: "#111111",
          arrowColor: "#111111",
          todayTextColor: "#DC143C",
          dayTextColor: "#111111",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  title: {
    color: "#111111",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 16,
  },
});
