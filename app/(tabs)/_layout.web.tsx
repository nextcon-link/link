import { Stack } from "expo-router";

export default function WebSharedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="shared" />
      <Stack.Screen name="index" />
      <Stack.Screen name="calendar" />
    </Stack>
  );
}
