import type { AnalyticsContributorsResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ContributorsProgress } from './contributors-progress';

export function ContributorsSheet({
  metricName,
  unit,
  data,
  loading,
  error,
  onRetry,
}: {
  metricName: string;
  unit: string;
  data: AnalyticsContributorsResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <View testID="contributors-sheet" className="gap-6">
      <View className="gap-1">
        <AppText variant="title">{metricName} contributors</AppText>
        <AppText variant="caption" className="text-muted">
          Share of recorded {metricName} intake
          {data === null
            ? ''
            : ` · ${data.resolvedRange.startDate} – ${data.resolvedRange.endDate}`}
        </AppText>
      </View>
      {loading ? (
        <AppText muted>Loading contributors…</AppText>
      ) : error !== null ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : data === null ? (
        <AppText muted>No recorded contributors in this period.</AppText>
      ) : (
        <>
          <View className="gap-1">
            <AppText variant="label">Recorded total</AppText>
            <AppText
              variant="heading"
              className="text-[30px] leading-9 tabular-nums"
            >
              {data.recordedTotal.toLocaleString('en-US')} {unit}
            </AppText>
          </View>
          <ContributorsProgress contributors={data.contributors} />
          {data.remainder === null ? null : (
            <View className="flex-row items-center justify-between px-4">
              <AppText variant="label">Other recorded foods</AppText>
              <AppText variant="caption" className="text-muted">
                {Math.round(data.remainder.percentage * 100)}%
              </AppText>
            </View>
          )}
          <AppText variant="caption" className="text-muted">
            Percentages use only foods where this nutrient was recorded; unknown
            nutrient values are excluded rather than treated as zero.
          </AppText>
        </>
      )}
    </View>
  );
}
