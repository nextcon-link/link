import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, AppState, View } from 'react-native';
import * as Linking from 'expo-linking';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { importSharedBundleFromUrl } from '@/services/sharedBundleService';
import { pollRemoteChanges, syncAll } from '@/services/syncEngine';
import { useAuthStore } from '@/store/auth';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const initialize = useAuthStore((state) => state.initialize);
  const session = useAuthStore((state) => state.session);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized) return;

    const currentRoot = segments[0];
    const isAuthRoute =
      currentRoot === 'login' ||
      currentRoot === 'signup' ||
      currentRoot === 'auth-callback';

    if (!session && !isAuthRoute) {
      router.replace('/login');
      return;
    }

    if (session && isAuthRoute) {
      router.replace('/');
    }
  }, [isInitialized, router, segments, session]);

  useEffect(() => {
    if (session) {
      syncAll();
    }
  }, [session]);

  useEffect(() => {
    if (!isInitialized || !session?.user?.id) return;

    const handleUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      const target = parsed.path ?? parsed.hostname;
      if (target !== 'shared-bundle') return;

      const imported = await importSharedBundleFromUrl(url, session.user.id);
      if (imported) {
        Alert.alert('일정 덩어리 추가 완료', '공유 페이지의 일정 추가 목록에 저장했어요.');
        router.replace('/shared');
      } else {
        Alert.alert('추가 실패', '공유 QR 데이터를 읽을 수 없어요.');
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, [isInitialized, router, session]);

  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        pollRemoteChanges();
      }
    }, 30000);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncAll();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [session]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="labels" options={{ title: '라벨 관리' }} />
        <Stack.Screen name="google" options={{ title: 'Google Calendar' }} />
        <Stack.Screen name="friends" options={{ title: '친구' }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="modal"  options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
