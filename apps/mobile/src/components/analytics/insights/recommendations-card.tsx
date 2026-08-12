import type { Recommendation } from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

export function RecommendationsCard({
  recommendations,
  dismissedRecommendations,
  error,
  onDismiss,
}: {
  recommendations: readonly Recommendation[];
  dismissedRecommendations: readonly Recommendation[];
  error: string | null;
  onDismiss: (id: string) => void;
}) {
  return (
    <View testID="complex-insights-recommendations-card" className="gap-3">
      <View className="gap-1">
        <AppText variant="heading" className="text-[25px] leading-8">
          Recommendations
        </AppText>
        <AppText variant="caption" className="text-muted">
          {recommendations.length} active · evidence from the current reporting
          period
        </AppText>
      </View>
      {error !== null ? (
        <AppCard className="gap-2 bg-module p-4">
          <AppText variant="label">Recommendations unavailable</AppText>
          <AppText variant="caption" className="text-muted">
            Insights remain available while recommendations retry.
          </AppText>
        </AppCard>
      ) : recommendations.length === 0 ? (
        <AppCard className="bg-module p-4">
          <AppText variant="caption" className="text-muted">
            No active recommendations right now.
          </AppText>
        </AppCard>
      ) : (
        recommendations.map((recommendation) => (
          <AppCard
            key={recommendation.id}
            elevated
            className="gap-3 border-l-[6px] border-l-ink p-[18px]"
          >
            <AppText variant="caption" className="text-muted">
              PRIORITY
            </AppText>
            <AppText variant="heading" className="text-[18px] leading-6">
              {recommendation.title}
            </AppText>
            <AppText className="text-muted">{recommendation.message}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Dismiss recommendation: ${recommendation.title}`}
              className="self-end min-h-10 justify-center"
              onPress={() => onDismiss(recommendation.id)}
            >
              <AppText variant="label">Dismiss</AppText>
            </Pressable>
          </AppCard>
        ))
      )}
      {dismissedRecommendations.length === 0 ? null : (
        <>
          <AppText variant="heading" className="mt-3 text-[18px] leading-6">
            Dismissed and completed
          </AppText>
          <AppCard className="bg-module p-4">
            {dismissedRecommendations.slice(0, 3).map((recommendation) => (
              <AppText
                key={recommendation.id}
                variant="caption"
                className="text-muted"
              >
                {recommendation.title}
              </AppText>
            ))}
          </AppCard>
        </>
      )}
    </View>
  );
}
