import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { importSharedBundlePayload } from "@/services/sharedBundleService";
import { decodeSharedBundlePayload } from "@/services/sharedBundlePayload";
import { useAuthStore } from "@/store/auth";

export default function SharedBundleImportScreen() {
  const { bundle } = useLocalSearchParams();
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const [message, setMessage] = useState("공유 일정을 불러오는 중입니다.");
  const payload = useMemo(() => decodeSharedBundlePayload(bundle), [bundle]);

  useEffect(() => {
    if (!isInitialized) return;

    if (!userId) {
      router.replace("/login");
      return;
    }

    async function importBundle() {
      if (!payload) {
        setMessage("공유 QR 데이터를 읽을 수 없어요.");
        Alert.alert("추가 실패", "공유 QR 데이터를 읽을 수 없어요.");
        router.replace("/shared");
        return;
      }

      const imported = await importSharedBundlePayload(payload, userId);
      if (imported) {
        Alert.alert("일정 덩어리 추가 완료", "공유 페이지의 일정 추가 목록에 저장했어요.");
      } else {
        Alert.alert("추가 실패", "공유 QR 데이터를 읽을 수 없어요.");
      }
      router.replace("/shared");
    }

    importBundle();
  }, [isInitialized, payload, userId]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator />
      <Text style={{ color: "#111", fontSize: 15, fontWeight: "700" }}>
        {message}
      </Text>
    </View>
  );
}
