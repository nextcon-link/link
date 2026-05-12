import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { saveWebSharedBundle } from "@/services/sharedBundleWebStorage";

export default function WebSharedBundleImportScreen() {
  const { bundle } = useLocalSearchParams();
  const hasHandledBundle = useRef(false);
  const [message, setMessage] = useState("공유 일정을 저장하는 중입니다.");

  useEffect(() => {
    const encodedBundle = Array.isArray(bundle) ? bundle[0] : bundle;
    if (!encodedBundle) {
      setMessage("공유 QR 데이터를 읽을 수 없어요.");
      return;
    }

    if (hasHandledBundle.current) return;
    hasHandledBundle.current = true;

    const stored = saveWebSharedBundle(encodedBundle);
    if (!stored) {
      setMessage("공유 QR 데이터를 읽을 수 없어요.");
      return;
    }

    const sharedUrl = new URL("/shared", window.location.origin);
    sharedUrl.searchParams.set("week", stored.weekKey);
    window.location.replace(sharedUrl.toString());
  }, [bundle]);

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
