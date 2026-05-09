import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { supabase } from "@/services/supabaseApi";

function collectAuthParams(url: string): URLSearchParams {
  const params = new URLSearchParams();
  const query = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
  const hash = url.includes("#") ? url.split("#")[1] : "";

  for (const source of [query, hash]) {
    const sourceParams = new URLSearchParams(source);
    sourceParams.forEach((value, key) => params.set(key, value));
  }

  return params;
}

async function completeAuthFromUrl(url: string): Promise<void> {
  const params = collectAuthParams(url);
  const error = params.get("error") ?? params.get("error_description");
  if (error) throw new Error(error);

  const code = params.get("code");
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      code,
    );
    if (exchangeError) throw exchangeError;
    return;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return;
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session) throw new Error("인증 링크에 세션 정보가 없습니다.");
}

export default function AuthCallbackScreen() {
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url || handledRef.current) return;
      handledRef.current = true;

      try {
        await completeAuthFromUrl(url);
        router.replace("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "이메일 인증에 실패했습니다.");
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {error ? (
          <>
            <Text style={styles.title}>인증 실패</Text>
            <Text style={styles.message}>{error}</Text>
            <Pressable
              style={styles.button}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.buttonText}>로그인으로 돌아가기</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator />
            <Text style={styles.title}>이메일 인증 중</Text>
            <Text style={styles.message}>잠시만 기다려 주세요.</Text>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  title: {
    marginTop: 14,
    color: "#111",
    fontSize: 24,
    fontWeight: "800",
  },
  message: {
    marginTop: 8,
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#111",
    marginTop: 20,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
