import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerTitleStyle: { fontWeight: '600' },
          headerBackTitle: 'Back',
        }}
      />
      <StatusBar style="dark" />
    </>
  );
}
