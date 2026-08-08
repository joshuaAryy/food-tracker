import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { analyticsMetricForKey } from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import {
  simpleTrendMetrics,
  trendRouteForMetric,
} from '@/lib/analytics/trend-routing';

export default function TrendsExploreScreen() {
  const router = useRouter();
  return (
    <AppScreen backgroundColor="#FFFFFF" contentClassName="gap-5">
      <ScreenHeader
        title="Explore Trends"
        subtitle="Choose a focused view for the last 7, 30, or 90 days."
      />
      <View className="gap-2">
        {simpleTrendMetrics.map((metric) => {
          const definition = analyticsMetricForKey(metric);
          return (
            <Pressable
              key={metric}
              accessibilityRole="button"
              accessibilityLabel={`View ${definition.displayName} trend`}
              className="min-h-11 rounded-app border border-line bg-module px-4 py-3 active:opacity-70"
              onPress={() => router.push(trendRouteForMetric(metric) as never)}
            >
              <AppText variant="label">{definition.displayName}</AppText>
              <AppText variant="caption" muted>
                {definition.unit}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}
