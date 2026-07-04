import { View } from 'react-native';
import { Tabs } from 'expo-router';
import {
  BarChart3,
  CalendarDays,
  Lightbulb,
  UserRound,
} from 'lucide-react-native';
import { FloatingActionWheel } from '@/components/floating-action-wheel';
import { colors } from '@/theme/tokens';

type TabIconComponent = typeof BarChart3;

function TabIcon({
  Icon,
  color,
  focused,
}: {
  Icon: TabIconComponent;
  color: string;
  focused: boolean;
}) {
  return (
    <View
      className={`h-8 w-8 items-center justify-center rounded-full ${
        focused ? 'bg-primary-soft' : ''
      }`}
    >
      <Icon color={color} size={21} strokeWidth={focused ? 2.8 : 2.45} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <View className="w-full max-w-[520px] flex-1 self-center overflow-hidden web:border-x web:border-border">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.light.primaryDark,
          tabBarInactiveTintColor: '#4A4A46',
          tabBarStyle: {
            height: 78,
            paddingTop: 7,
            paddingBottom: 16,
            backgroundColor: colors.light.module,
            borderTopColor: 'transparent',
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
          },
          sceneStyle: { backgroundColor: colors.light.canvas },
        }}
      >
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarItemStyle: { marginRight: 8 },
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                Icon={BarChart3}
                color={String(color)}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarItemStyle: { marginRight: 42 },
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                Icon={CalendarDays}
                color={String(color)}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: 'Insights',
            tabBarItemStyle: { marginLeft: 42 },
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                Icon={Lightbulb}
                color={String(color)}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarItemStyle: { marginLeft: 8 },
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                Icon={UserRound}
                color={String(color)}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
      <FloatingActionWheel />
    </View>
  );
}
