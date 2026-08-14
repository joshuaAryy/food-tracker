import type { Recommendation } from '@food-tracker/shared';
import { RecommendationsCard } from './recommendations-card';

export function ComplexInsightsRecommendations({
  recommendations,
  dismissedRecommendations,
  error,
  onDismiss,
  compact = false,
}: {
  recommendations: readonly Recommendation[];
  dismissedRecommendations: readonly Recommendation[];
  error: string | null;
  onDismiss: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <RecommendationsCard
      recommendations={recommendations}
      dismissedRecommendations={dismissedRecommendations}
      error={error}
      onDismiss={onDismiss}
      compact={compact}
    />
  );
}
