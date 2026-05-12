import { Stack, useLocalSearchParams, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { saveWebSharedBundle } from "@/services/sharedBundleWebStorage";

export default function WebSharedBundleImportScreen() {
  const { bundle } = useLocalSearchParams();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const hasHandledBundle = useRef(false);
  const [message, setMessage] = useState("공유 일정을 저장하는 중입니다.");

  useEffect(() => {
    if (!rootNavigationState?.key) return;

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

    router.replace({
      pathname: "/shared",
      params: { week: stored.weekKey },
    });
  }, [bundle, rootNavigationState?.key, router]);

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
