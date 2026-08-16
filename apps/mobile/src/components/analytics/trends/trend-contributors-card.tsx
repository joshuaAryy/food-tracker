import { Pressable, View } from 'react-native';
import type { AnalyticsContributor } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { formatMetricValue } from '@/lib/reporting-ui';

export function TrendContributorsCard({
  contributors,
  onOpenAll,
}: {
  contributors: readonly AnalyticsContributor[];
  onOpenAll: () => void;
}) {
  return (
    <View className="gap-3">
      <AppText variant="label">Top contributors</AppText>
      {contributors.length === 0 ? (
        <AppText variant="caption" className="text-muted">
          Contributors are unavailable for this period.
        </AppText>
      ) : (
        <AppCard compact className="gap-0">
          {contributors.slice(0, 3).map((contributor, index) => (
            <View
              key={contributor.foodName}
              className="flex-row items-center justify-between border-b border-border py-3 last:border-b-0"
            >
              <AppText className="min-w-0 flex-1" numberOfLines={1}>
                {index + 1}. {contributor.foodName}
              </AppText>
              <AppText variant="caption" className="text-muted">
                {formatMetricValue(contributor.percentage * 100)}%
              </AppText>
            </View>
          ))}
        </AppCard>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See all contributors"
        className="min-h-11 self-end justify-center"
        onPress={onOpenAll}
      >
        <AppText variant="caption" className="font-semibold">
          See all contributors ›
        </AppText>
      </Pressable>
    </View>
  );
}
