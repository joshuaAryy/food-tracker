import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { mockDashboardCards, mockNavigationItems } from '@/lib/mock-data';

export default function DashboardScreen() {
  return (
    <PlaceholderScreen
      title="Dashboard"
      description="A mock overview of the current local tracking day."
    >
      <View className="gap-3">
        {mockDashboardCards.map((card) => (
          <View key={card.label} className="rounded-xl bg-white p-4">
            <Text className="text-sm text-slate-500">{card.label}</Text>
            <Text className="mt-1 text-xl font-semibold text-slate-900">
              {card.value}
            </Text>
          </View>
        ))}
      </View>
      <View className="gap-2">
        {mockNavigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl bg-slate-900 px-4 py-3 text-center font-semibold text-white"
          >
            {item.label}
          </Link>
        ))}
      </View>
    </PlaceholderScreen>
  );
}
