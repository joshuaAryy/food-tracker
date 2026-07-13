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
          name="meal-describe"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="weight-log"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="recipes/index"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="recipes/[id]"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="recipes/editor"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="recipes/log"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="recipes/ingredient-serving"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="food-log/mixed-meal"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="food-log/manual-foods"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="food-log/manual-food"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="food-log/library"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="food-log/library-detail"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="food-log/default-serving"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
