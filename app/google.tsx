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
  connectGoogleCalendar,
  getGoogleConnectionStatus,
  syncGoogleCalendarNow,
  type GoogleConnectionStatus,
} from "@/services/googleCalendarApi";
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
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  return (
    <>
      <Stack.Screen options={{ title: "Google Calendar" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
            <Text style={styles.statusMeta}>
              동기화된 캘린더 {status?.calendarCount ?? 0}개
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
});
