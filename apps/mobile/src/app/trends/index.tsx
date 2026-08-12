import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import type {
  AnalyticsMetricDefinition,
  AnalyticsMetricKey,
  AnalyticsPreferenceValue,
  AnalyticsSavedView,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { ErrorState } from '@/components/error-state';
import { ExploreAll } from '@/components/analytics/trends/explore-all';
import { ExploreCurated } from '@/components/analytics/trends/explore-curated';
import { api, errorMessage } from '@/lib/api-client';
import { trendRouteForMetric } from '@/lib/analytics/trend-routing';
import {
  trendQueryFromSavedView,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

const fallbackPreference: AnalyticsPreferenceValue = {
  preferredSimpleMetric: 'calories',
  pinnedSavedViewId: null,
};

export default function TrendsExploreScreen() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<{
    mode: 'simple' | 'complex';
    metrics: AnalyticsMetricDefinition[];
  } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [preferences, setPreferences] =
    useState<AnalyticsPreferenceValue>(fallbackPreference);
  const [savedViews, setSavedViews] = useState<AnalyticsSavedView[]>([]);
  const [query, setQuery] = useState('');
  const [secondaryError, setSecondaryError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const nextCatalog = await api.analytics.trendCatalog();
      setCatalog(nextCatalog);
      try {
        const nextPreferences = await api.analytics.preferences();
        setPreferences(nextPreferences);
        if (nextCatalog.mode === 'complex') {
          setSavedViews(await api.analytics.savedViews());
        } else {
          setSavedViews([]);
        }
        setSecondaryError(null);
      } catch (cause) {
        setSecondaryError(errorMessage(cause));
      }
    } catch (cause) {
      setCatalogError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const definitions = useMemo(() => catalog?.metrics ?? [], [catalog?.metrics]);
  const openMetric = (metric: AnalyticsMetricKey) => {
    router.push(trendRouteForMetric(metric) as never);
  };
  const openSavedView = (view: AnalyticsSavedView) => {
    const query = trendQueryFromSavedView(view);
    if (query === null) return;
    router.push({
      pathname: '/trends/[metric]',
      params: {
        metric: query.primaryMetric,
        query: trendQueryRouteParam(query),
      },
    } as never);
  };

  return (
    <AppScreen
      backgroundColor="#FFFFFF"
      contentClassName="gap-7 pb-8"
      onRefresh={() => void loadCatalog()}
      refreshing={catalog === null && catalogError === null}
    >
      {catalogError !== null ? (
        <ErrorState message={catalogError} onRetry={() => void loadCatalog()} />
      ) : catalog === null ? null : catalog.mode === 'simple' ? (
        <ExploreCurated
          definitions={definitions}
          preferredMetric={preferences.preferredSimpleMetric}
          onBack={() => router.back()}
          onMetric={openMetric}
        />
      ) : (
        <ExploreAll
          definitions={definitions}
          savedViews={savedViews}
          pinnedSavedViewId={preferences.pinnedSavedViewId}
          query={query}
          onQueryChange={setQuery}
          onBack={() => router.back()}
          onMetric={openMetric}
          onOpenSavedView={openSavedView}
          onManageSavedViews={() => router.push('/trends/saved-views' as never)}
          onOpenNutrientLibrary={() =>
            router.push('/trends/nutrients' as never)
          }
        />
      )}
      {secondaryError !== null ? (
        <ErrorState
          title="Some Explore details are unavailable"
          message="The metric catalog remains available. Retry to load saved-view details."
          onRetry={() => void loadCatalog()}
        />
      ) : null}
    </AppScreen>
  );
}
