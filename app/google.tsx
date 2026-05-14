import { router, Stack } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleConnectionStatus,
  syncGoogleCalendarNow,
  type GoogleConnectionStatus,
} from "@/services/googleCalendarApi";
import { requestCalendarPermission } from "@/services/deviceSync";
import {
  isDeviceCalendarLabEnabled,
  setDeviceCalendarLabEnabled,
} from "@/services/deviceCalendarSettings";
import { syncAll } from "@/services/syncEngine";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return `${fallback} (${error.message})`;
  }
  return fallback;
}

function formatStatusDate(value: string | null): string {
  if (!value) return "아직 동기화 전";
  return new Date(value).toLocaleString();
}

export default function GoogleCalendarScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeviceLabEnabled, setIsDeviceLabEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setStatus(await getGoogleConnectionStatus());
    } catch (e) {
      setError(getErrorMessage(e, "Google Calendar 연결 상태를 불러오지 못했습니다."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    isDeviceCalendarLabEnabled().then(setIsDeviceLabEnabled);
  }, []);

  const handleConnect = async () => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const nextStatus = await connectGoogleCalendar();
      setStatus(nextStatus);
      await syncAll();
      setMessage("Google Calendar를 연결하고 동기화했습니다.");
    } catch (e) {
      setError(getErrorMessage(e, "Google Calendar 연결에 실패했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async () => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const nextStatus = await syncGoogleCalendarNow();
      setStatus(nextStatus);
      await syncAll();
      setMessage("Google Calendar 동기화를 완료했습니다.");
    } catch (e) {
      setError(getErrorMessage(e, "Google Calendar 동기화에 실패했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const nextStatus = await disconnectGoogleCalendar();
      setStatus(nextStatus);
      await syncAll();
      setMessage("Google Calendar 연결을 해제했습니다.");
    } catch (e) {
      setError(getErrorMessage(e, "Google Calendar 연결 해제에 실패했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDeviceLab = async () => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (isDeviceLabEnabled) {
        await setDeviceCalendarLabEnabled(false);
        setIsDeviceLabEnabled(false);
        setMessage("기기 캘린더 실험실 기능을 껐습니다.");
        return;
      }

      const hasPermission = await requestCalendarPermission();
      if (!hasPermission) {
        setError("기기 캘린더 권한이 필요합니다.");
        return;
      }

      await setDeviceCalendarLabEnabled(true);
      setIsDeviceLabEnabled(true);
      setMessage("기기 캘린더 실험실 기능을 켰습니다.");
    } catch (e) {
      setError(getErrorMessage(e, "기기 캘린더 실험실 설정에 실패했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Google Calendar" }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 20 + insets.bottom },
        ]}
      >
        <Text style={styles.title}>Google Calendar</Text>
        <Text style={styles.subtitle}>
          Google의 캘린더는 Link의 라벨로 가져오고, 앱에서 만든 라벨은 Google 캘린더로 생성됩니다.
        </Text>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>연결 상태</Text>
            <Text style={styles.statusValue}>
              {status?.isConnected ? "연결됨" : "연결 안 됨"}
            </Text>
            {status?.isConnected && status.googleEmail && (
              <Text style={styles.statusMeta}>{status.googleEmail}</Text>
            )}
            <Text style={styles.statusMeta}>
              동기화된 캘린더 {status?.calendarCount ?? 0}개
            </Text>
            <Text style={styles.statusMeta}>
              실시간 감지 미지원 {status?.watchUnsupportedCount ?? 0}개
            </Text>
            <Text style={styles.statusMeta}>
              오류 캘린더 {status?.failedCalendarCount ?? 0}개
            </Text>
            <Text style={styles.statusMeta}>
              마지막 동기화 {formatStatusDate(status?.lastSyncAt ?? null)}
            </Text>
            {status?.lastError && (
              <Text style={styles.errorText}>{status.lastError}</Text>
            )}
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
        {message && <Text style={styles.messageText}>{message}</Text>}

        <Pressable
          disabled={isSubmitting}
          onPress={handleConnect}
          style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {status?.isConnected ? "다시 연결" : "Google Calendar 연결"}
            </Text>
          )}
        </Pressable>

        <Pressable
          disabled={isSubmitting || !status?.isConnected}
          onPress={handleSync}
          style={[
            styles.secondaryButton,
            (isSubmitting || !status?.isConnected) && styles.disabledButton,
          ]}
        >
          <Text style={styles.secondaryButtonText}>지금 동기화</Text>
        </Pressable>

        <Pressable
          disabled={isSubmitting || !status?.isConnected}
          onPress={handleDisconnect}
          style={[
            styles.dangerButton,
            (isSubmitting || !status?.isConnected) && styles.disabledButton,
          ]}
        >
          <Text style={styles.dangerButtonText}>연결 해제</Text>
        </Pressable>

        <View style={styles.labBox}>
          <View style={styles.labHeader}>
            <View style={styles.labTitleBox}>
              <Text style={styles.labTitle}>실험실</Text>
              <Text style={styles.labSubtitle}>
                기기 캘린더를 라벨처럼 불러옵니다.
              </Text>
            </View>
            <Pressable
              disabled={isSubmitting}
              onPress={handleToggleDeviceLab}
              style={[
                styles.toggleTrack,
                isDeviceLabEnabled && styles.toggleTrackOn,
                isSubmitting && styles.disabledButton,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  isDeviceLabEnabled && styles.toggleThumbOn,
                ]}
              />
            </Pressable>
          </View>
          <Text style={styles.labDescription}>
            iCloud, Samsung Calendar 등 휴대폰에 등록된 캘린더를 표시하고 편집합니다. 기기 설정에 따라 읽기전용이거나 중복될 수 있습니다.
          </Text>
          {isDeviceLabEnabled && (
            <Pressable
              style={styles.deviceSettingsButton}
              onPress={() => router.push("/device-calendars")}
            >
              <Text style={styles.deviceSettingsButtonText}>
                기기 캘린더 라벨 설정
              </Text>
            </Pressable>
          )}
        </View>
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
    marginTop: 8,
    marginBottom: 20,
  },
  loadingBox: {
    alignItems: "center",
    padding: 24,
  },
  statusBox: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  statusLabel: {
    color: "#777",
    fontSize: 13,
    fontWeight: "700",
  },
  statusValue: {
    color: "#111",
    fontSize: 22,
    fontWeight: "800",
  },
  statusMeta: {
    color: "#555",
    fontSize: 14,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#111",
    marginTop: 8,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#111",
    marginTop: 10,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
  },
  dangerButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#D9534F",
    marginTop: 10,
  },
  dangerButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.55,
  },
  errorText: {
    color: "#D9534F",
    fontSize: 13,
    marginBottom: 10,
  },
  messageText: {
    color: "#2E7D32",
    fontSize: 13,
    marginBottom: 10,
  },
  labBox: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    marginTop: 24,
    padding: 16,
    gap: 10,
  },
  labHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  labTitleBox: {
    flex: 1,
  },
  labTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "800",
  },
  labSubtitle: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  labDescription: {
    color: "#666",
    fontSize: 13,
    lineHeight: 19,
  },
  toggleTrack: {
    width: 50,
    height: 30,
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#D6D6D6",
    paddingHorizontal: 3,
  },
  toggleTrackOn: {
    backgroundColor: "#111",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF",
  },
  toggleThumbOn: {
    alignSelf: "flex-end",
  },
  deviceSettingsButton: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  deviceSettingsButtonText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "800",
  },
});
