import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Recommendation } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';

export default function InsightsScreen() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecommendations(await api.recommendations.list());
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInsights();
    }, [loadInsights]),
  );

  if (loading) {
    return (
      <AppScreen>
        <LoadingState message="Checking for insights…" />
      </AppScreen>
    );
  }

  if (error !== null && recommendations.length === 0) {
    return (
      <AppScreen>
        <ScreenHeader
          title="Insights"
          subtitle="Deterministic guidance from your tracking data."
        />
        <ErrorState
          title="Insights are unavailable"
          message={error}
          onRetry={() => void loadInsights()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        title="Insights"
        subtitle="Deterministic guidance from your tracking data."
      />

      {error === null ? null : (
        <ErrorState
          title="Couldn’t refresh insights"
          message={error}
          onRetry={() => void loadInsights()}
        />
      )}

      {recommendations.length === 0 ? (
        <EmptyState
          title="Insights will appear here"
          message="The recommendation endpoint is connected. Guidance will show when the backend provides recommendation objects."
          symbol="✦"
        />
      ) : (
        <View className="gap-3">
          {recommendations.map((recommendation) => (
            <AppCard key={recommendation.id} compact className="gap-2">
              <AppText variant="caption" className="uppercase text-sage-dark">
                {recommendation.severity} priority
              </AppText>
              <AppText variant="heading">{recommendation.title}</AppText>
              <AppText muted>{recommendation.message}</AppText>
            </AppCard>
          ))}
        </View>
      )}

      <AppCard compact className="gap-2 bg-surface">
        <AppText variant="label">How insights work</AppText>
        <AppText muted>
          Nutrition math and recommendation decisions remain deterministic in
          the backend. This screen only presents the returned facts.
        </AppText>
      </AppCard>
    </AppScreen>
  );
}
