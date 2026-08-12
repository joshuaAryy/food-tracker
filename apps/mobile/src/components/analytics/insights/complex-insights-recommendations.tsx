import type { Recommendation } from '@food-tracker/shared';
import { RecommendationsCard } from './recommendations-card';

export function ComplexInsightsRecommendations({
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
    <RecommendationsCard
      recommendations={recommendations}
      dismissedRecommendations={dismissedRecommendations}
      error={error}
      onDismiss={onDismiss}
    />
  );
}
