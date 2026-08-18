import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthBootstrap } from '@/components/auth/auth-bootstrap';
import { colors } from '@/theme/tokens';
import '../global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView testID="gesture-handler-root" style={{ flex: 1 }}>
      <AuthBootstrap>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.light.canvas },
            headerShown: false,
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="index" />
          <Stack.Screen name="streaks" />
          <Stack.Screen name="trends" />
          <Stack.Screen
            name="trends/saved-views"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
          <Stack.Screen
            name="trends/save-view"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
          <Stack.Screen
            name="trends/configure"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
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
            name="photo-log"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
          <Stack.Screen
            name="photo-log/camera"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
          <Stack.Screen
            name="photo-log/review"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
          <Stack.Screen
            name="photo-log/search"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
          <Stack.Screen
            name="photo-log/confirm"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
          <Stack.Screen
            name="weight-log"
            options={{ presentation: 'modal', gestureEnabled: true }}
          />
          <Stack.Screen
            name="water-log"
            options={{
              presentation: 'formSheet',
              gestureEnabled: true,
              sheetAllowedDetents: [0.85],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: false,
              sheetCornerRadius: 28,
            }}
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
      </AuthBootstrap>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
