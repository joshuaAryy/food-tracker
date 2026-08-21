import { View } from 'react-native';
import type { AnalyticsContributor } from '@food-tracker/shared';
import { AppText } from '@/components/app-text';

export function ContributorsProgress({
  contributors,
}: {
  contributors: readonly AnalyticsContributor[];
}) {
  return (
    <View className="gap-0 rounded-[20px] border border-border px-4">
      {contributors.map((contributor, index) => (
        <View
          key={contributor.foodName}
          className="gap-2 border-b border-border py-4 last:border-b-0"
        >
          <View className="flex-row items-center justify-between gap-3">
            <AppText className="min-w-0 flex-1" numberOfLines={1}>
              {index + 1}. {contributor.foodName}
            </AppText>
            <AppText variant="caption" className="text-muted">
              {Math.round(contributor.percentage * 100)}%
            </AppText>
          </View>
          <View
            accessible
            accessibilityLabel={`${contributor.foodName} contributes ${Math.round(contributor.percentage * 100)} percent`}
            className="h-1.5 overflow-hidden rounded-full bg-module"
          >
            <View
              className="h-1.5 rounded-full bg-primary"
              style={{
                width: `${Math.max(0, Math.min(100, contributor.percentage * 100))}%`,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
