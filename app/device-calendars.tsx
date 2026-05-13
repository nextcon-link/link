import { Stack } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getDeviceCalendarOptions,
} from "@/services/deviceSync";
import {
  setDeviceCalendarSelected,
  type DeviceCalendarOption,
} from "@/services/deviceCalendarSettings";

function providerLabel(provider: DeviceCalendarOption["provider"]) {
  switch (provider) {
    case "apple":
      return "Apple";
    case "google":
      return "Google";
    case "samsung":
      return "Samsung";
    case "exchange":
      return "Exchange";
    case "local":
      return "기기";
    default:
      return "기타";
  }
}

function disabledText(reason: DeviceCalendarOption["disabledReason"]) {
  if (reason === "same_google_account") {
    return "Google 연동 계정과 같아 제외됨";
  }
  return null;
}

export default function DeviceCalendarsScreen() {
  const [calendars, setCalendars] = useState<DeviceCalendarOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setCalendars(await getDeviceCalendarOptions());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "기기 캘린더 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleCalendar = async (calendar: DeviceCalendarOption) => {
    if (calendar.disabledReason) return;
    await setDeviceCalendarSelected(calendar.id, !calendar.selected);
    await refresh();
  };

  return (
    <>
      <Stack.Screen options={{ title: "기기 캘린더 라벨" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>기기 캘린더 라벨</Text>
        <Text style={styles.subtitle}>
          iCloud, Samsung, Google 등 휴대폰에 등록된 캘린더를 라벨처럼 표시합니다.
        </Text>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
          </View>
        ) : (
          calendars.map((calendar) => {
            const disabled = Boolean(calendar.disabledReason);
            const warning = calendar.mayDuplicateGoogle
              ? "Google 연동과 중복될 수 있음"
              : disabledText(calendar.disabledReason);

            return (
              <Pressable
                key={calendar.id}
                disabled={disabled}
                style={[
                  styles.calendarRow,
                  calendar.selected && styles.calendarRowSelected,
                  disabled && styles.calendarRowDisabled,
                ]}
                onPress={() => toggleCalendar(calendar)}
              >
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: calendar.color || "#A8C8F0" },
                  ]}
                />
                <View style={styles.calendarBody}>
                  <Text style={styles.calendarTitle}>{calendar.title}</Text>
                  <Text style={styles.calendarMeta}>
                    {providerLabel(calendar.provider)}
                    {calendar.ownerAccount ? ` · ${calendar.ownerAccount}` : ""}
                    {!calendar.allowsModifications ? " · 읽기전용" : ""}
                  </Text>
                  {warning && <Text style={styles.warningText}>{warning}</Text>}
                </View>
                <Text style={styles.selectedText}>
                  {calendar.selected ? "켬" : "끔"}
                </Text>
              </Pressable>
            );
          })
        )}

        {!isLoading && calendars.length === 0 && (
          <Text style={styles.emptyText}>사용 가능한 기기 캘린더가 없습니다.</Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    gap: 10,
  },
  title: {
    color: "#111",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  loadingBox: {
    alignItems: "center",
    padding: 24,
  },
  calendarRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E3E3E3",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#FAFAFA",
  },
  calendarRowSelected: {
    borderColor: "#111",
    backgroundColor: "#FFFFFF",
  },
  calendarRowDisabled: {
    opacity: 0.55,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  calendarBody: {
    flex: 1,
    minWidth: 0,
  },
  calendarTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "800",
  },
  calendarMeta: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  selectedText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "800",
  },
  warningText: {
    color: "#B26B00",
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
    marginTop: 16,
  },
  errorText: {
    color: "#D9534F",
    fontSize: 13,
    marginTop: 12,
  },
});
