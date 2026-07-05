import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme/tokens';
import '../global.css';

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.light.canvas },
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="food-log"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="barcode-scan"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="weight-log"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
