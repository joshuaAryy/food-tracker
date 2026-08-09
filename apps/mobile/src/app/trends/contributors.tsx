import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  analyticsMetricForKey,
  type AnalyticsContributorsResponse,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { trendQueryFromRouteParam } from '@/lib/analytics/saved-view-configuration';

export default function ContributorsScreen() {
  const { query: rawQuery } = useLocalSearchParams<{ query?: string }>();
  const query = useMemo(() => trendQueryFromRouteParam(rawQuery), [rawQuery]);
  const [contributors, setContributors] =
    useState<AnalyticsContributorsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (query === null) return;
    setError(null);
    try {
      setContributors(await api.analytics.contributors(query, true));
    } catch (cause) {
      setError(errorMessage(cause));
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
      {error === null ? null : (
        <ErrorState message={error} onRetry={() => void load()} />
      )}
      {contributors === null ? (
        <AppText muted>Loading contributors…</AppText>
      ) : (
        <>
          <AppText muted>
            Percentages use recorded {definition.displayName} only.
          </AppText>
          {contributors.contributors.map((contributor) => (
            <AppText key={contributor.foodName}>
              {contributor.foodName}: {contributor.value.toFixed(1)}{' '}
              {definition.unit} ({Math.round(contributor.percentage * 100)}%)
            </AppText>
          ))}
          {contributors.remainder === null ? null : (
            <AppText muted>
              Other recorded foods: {contributors.remainder.value.toFixed(1)}{' '}
              {definition.unit}
            </AppText>
          )}
        </>
      )}
    </AppScreen>
  );
}
