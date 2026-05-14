import { router, Stack } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuthStore } from "@/store/auth";

const DEV_TEST_ACCOUNT = {
  email: "test@test.com",
  password: "testtest",
};

export default function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    const message = await signIn(email, password);
    if (message) {
      setError(message);
      return;
    }

    router.replace("/");
  };

  const handleDevLogin = async () => {
    setError(null);
    setEmail(DEV_TEST_ACCOUNT.email);
    setPassword(DEV_TEST_ACCOUNT.password);

    const message = await signIn(
      DEV_TEST_ACCOUNT.email,
      DEV_TEST_ACCOUNT.password,
    );
    if (message) {
      setError(message);
      return;
    }

    router.replace("/");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.form}>
          <Text style={styles.title}>로그인</Text>
          <Text style={styles.subtitle}>캘린더를 동기화하려면 계정이 필요해요.</Text>

          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="이메일"
            placeholderTextColor="#999"
            style={styles.input}
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor="#999"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            disabled={isLoading}
            onPress={handleLogin}
            style={[styles.primaryButton, isLoading && styles.disabledButton]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>로그인</Text>
            )}
          </Pressable>

          {/* DEV_ONLY: remove DEV_TEST_ACCOUNT and this button before release. */}
          {/* <Pressable
            disabled={isLoading}
            onPress={handleDevLogin}
            style={[styles.devButton, isLoading && styles.disabledButton]}
          >
            <Text style={styles.devButtonText}>테스트 계정으로 로그인</Text>
          </Pressable> */}

          <Pressable onPress={() => router.push("/signup")} style={styles.linkButton}>
            <Text style={styles.linkText}>회원가입</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  form: {
    gap: 12,
  },
  title: {
    color: "#111",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#666",
    fontSize: 15,
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#FAFAFA",
    borderColor: "#DDD",
    borderRadius: 10,
    borderWidth: 1,
    color: "#111",
    fontSize: 16,
    padding: 13,
  },
  error: {
    color: "#D9534F",
    fontSize: 13,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 10,
    minHeight: 48,
    justifyContent: "center",
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  devButton: {
    alignItems: "center",
    borderColor: "#111",
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: "center",
  },
  devButtonText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    padding: 12,
  },
  linkText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "600",
  },
});
