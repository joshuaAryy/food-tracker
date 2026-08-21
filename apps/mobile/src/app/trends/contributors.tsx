import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  analyticsMetricForKey,
  type AnalyticsContributorsResponse,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { ErrorState } from '@/components/error-state';
import { ContributorsSheet } from '@/components/analytics/nutrients/contributors-sheet';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import {
  commitAnalyticsOptionalResource,
  failAnalyticsOptionalResource,
  initialAnalyticsOptionalResource,
  startAnalyticsOptionalResource,
  type AnalyticsOptionalResource,
} from '@/lib/analytics/analytics-optional-resource';
import { trendQueryFromRouteParam } from '@/lib/analytics/saved-view-configuration';

export default function ContributorsScreen() {
  const { query: rawQuery } = useLocalSearchParams<{ query?: string }>();
  const query = useMemo(() => trendQueryFromRouteParam(rawQuery), [rawQuery]);
  const [resource, setResource] = useState<
    AnalyticsOptionalResource<AnalyticsContributorsResponse>
  >(initialAnalyticsOptionalResource);
  const load = useCallback(async () => {
    if (query === null) return;
    setResource((current) => startAnalyticsOptionalResource(current));
    try {
      const next = await api.analytics.contributors(query, true);
      setResource(commitAnalyticsOptionalResource(next));
    } catch (cause) {
      setResource((current) =>
        failAnalyticsOptionalResource(current, errorMessage(cause)),
      );
    }
  }, [query]);
  useEffect(() => {
    void load();
  }, [load]);
  if (query === null) {
    return (
      <AppScreen>
        <ErrorState message="This Trend configuration is unavailable." />
      </AppScreen>
    );
  }
  const definition = analyticsMetricForKey(query.primaryMetric);
  return (
    <AppScreen backgroundColor="#FFFFFF" contentClassName="gap-5">
      <ScreenHeader
        title="Food contributors"
        subtitle={definition.displayName}
      />
      <ContributorsSheet
        metricName={definition.displayName}
        unit={definition.unit}
        data={resource.data}
        loading={resource.status === 'loading'}
        error={resource.error}
        onRetry={() => void load()}
      />
    </AppScreen>
  );
}
