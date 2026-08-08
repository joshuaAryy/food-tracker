import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { AnalyticsSavedView } from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { api, errorMessage } from '@/lib/api-client';
import {
  trendQueryFromSavedView,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

export default function SavedViewsScreen() {
  const router = useRouter();
  const [views, setViews] = useState<AnalyticsSavedView[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [savedViews, preferences] = await Promise.all([
        api.analytics.savedViews(),
        api.analytics.preferences(),
      ]);
      setViews(savedViews);
      setPinnedId(preferences.pinnedSavedViewId);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (error !== null)
    return <ErrorState message={error} onRetry={() => void load()} />;
  return (
    <AppScreen contentClassName="gap-2">
      <AppText variant="title">Saved Views</AppText>
      {views.map((view) => (
        <View key={view.id} className="border-t border-line py-4 gap-2">
          <AppText variant="label">{view.name}</AppText>
          <AppText muted>
            {view.unavailableMetrics.length === 0
              ? `${view.periodDays}D`
              : `Needs replacement: ${view.unavailableMetrics.join(', ')}`}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${view.name}`}
            disabled={trendQueryFromSavedView(view) === null}
            onPress={() => {
              const query = trendQueryFromSavedView(view);
              if (query === null) return;
              router.push({
                pathname: '/trends/[metric]',
                params: {
                  metric: query.primaryMetric,
                  query: trendQueryRouteParam(query),
                },
              } as never);
            }}
          >
            <AppText variant="caption">Open</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              pinnedId === view.id ? `Unpin ${view.name}` : `Pin ${view.name}`
            }
            onPress={async () => {
              const preferences = await api.analytics.updatePreferences({
                pinnedSavedViewId: pinnedId === view.id ? null : view.id,
              });
              setPinnedId(preferences.pinnedSavedViewId);
            }}
          >
            <AppText variant="caption">
              {pinnedId === view.id ? 'Unpin' : 'Pin'}
            </AppText>
          </Pressable>
        </View>
      ))}
    </AppScreen>
  );
}
