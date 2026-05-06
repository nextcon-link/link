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

export default function SignupScreen() {
  const signUp = useAuthStore((state) => state.signUp);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSignup = async () => {
    setError(null);
    setInfo(null);

    if (!username.trim() || !displayName.trim()) {
      setError("아이디와 표시 이름을 입력하세요.");
      return;
    }

    const message = await signUp(email, password, username, displayName);
    if (message) {
      setError(message);
      return;
    }

    setInfo("이메일 인증 후 로그인하세요.");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.form}>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>Link에 오신 것을 환영합니다!</Text>

          <TextInput
            autoCapitalize="none"
            onChangeText={setUsername}
            placeholder="아이디"
            placeholderTextColor="#999"
            style={styles.input}
            value={username}
          />
          <TextInput
            onChangeText={setDisplayName}
            placeholder="표시 이름"
            placeholderTextColor="#999"
            style={styles.input}
            value={displayName}
          />
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
          {info && <Text style={styles.info}>{info}</Text>}

          <Pressable
            disabled={isLoading}
            onPress={handleSignup}
            style={[styles.primaryButton, isLoading && styles.disabledButton]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>가입하기</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace("/login")} style={styles.linkButton}>
            <Text style={styles.linkText}>로그인으로 돌아가기</Text>
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
  info: {
    color: "#2E7D32",
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
