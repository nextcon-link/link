import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Calendar } from "react-native-calendars";
import { router } from "expo-router";

import { getWeekKey } from "../../utils/date";

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>주 선택</Text>

      <Calendar
        monthFormat={"yyyy년 MM월"}
        hideArrows={false}
        enableSwipeMonths={true}
        onDayPress={(day) => {
          const week = getWeekKey(day.dateString);

          router.push({
            pathname: "/",
            params: { week, date: day.dateString },
          });
        }}
        theme={{
          backgroundColor: "#FFFFFF",
          calendarBackground: "#FFFFFF",
          textSectionTitleColor: "#111111",
          monthTextColor: "#111111",
          arrowColor: "#111111",
          todayTextColor: "#4A90E2",
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
    fontSize: 26,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 16,
  },
});
