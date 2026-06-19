import { Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { FloatingActionWheel } from '@/components/floating-action-wheel';
import { colors } from '@/theme/tokens';

export default function TabLayout() {
  return (
    <View className="w-full max-w-[520px] flex-1 self-center overflow-hidden web:border-x web:border-border">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.light.primaryDark,
          tabBarInactiveTintColor: colors.light.muted,
          tabBarStyle: {
            height: 78,
            paddingTop: 7,
            paddingBottom: 16,
            backgroundColor: colors.light.surfaceRaised,
            borderTopColor: colors.light.border,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          sceneStyle: { backgroundColor: colors.light.canvas },
        }}
      >
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 22, lineHeight: 24 }}>◔</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 22, lineHeight: 24 }}>◷</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: 'Insights',
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 22, lineHeight: 24 }}>✦</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 22, lineHeight: 24 }}>○</Text>
            ),
          }}
        />
      </Tabs>
      <FloatingActionWheel />
    </View>
  );
}
