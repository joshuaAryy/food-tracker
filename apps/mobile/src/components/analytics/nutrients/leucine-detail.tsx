import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { NutrientReferenceSummary } from './nutrient-reference-summary';
import { formatMetricWithUnit } from '@/lib/reporting-ui';

export function LeucineDetail({ trend }: { trend: CanonicalTrendResponse }) {
  const entry = trend.aminoAcidProfile?.entries.find(
    (candidate) => candidate.metric === 'leucine',
  );
  return (
    <View className="gap-3">
      <View className="gap-1">
        <AppText variant="label">Leucine target detail</AppText>
        <AppText variant="caption" className="text-muted">
          Individual amino-acid trend and target consistency
        </AppText>
      </View>
      <AppCard className="gap-2 bg-module p-4">
        <AppText variant="label">Target consistency</AppText>
        <AppText variant="caption" className="text-muted">
          {entry?.average === null || entry === undefined
            ? 'No recorded Leucine data in this period.'
            : `${formatMetricWithUnit(entry.average, 'g')} average`}
        </AppText>
        <NutrientReferenceSummary
          reference={entry?.reference ?? trend.reference}
        />
        {entry?.percentage === null || entry === undefined ? (
          <AppText variant="caption" className="text-muted">
            Target consistency unavailable for this period.
          </AppText>
        ) : (
          <>
            <View className="flex-row items-center justify-between gap-3">
              <AppText variant="caption" className="text-muted">
                {entry.status === 'meets_minimum'
                  ? 'At least 90% of target'
                  : entry.status === 'below_minimum'
                    ? 'Below target'
                    : 'Unknown'}
              </AppText>
              <AppText variant="label">{Math.round(entry.percentage)}%</AppText>
            </View>
            <View
              accessible
              accessibilityLabel={`Leucine target consistency ${Math.round(entry.percentage)} percent`}
              className="h-2 overflow-hidden rounded-full bg-border"
            >
              <View
                className="h-2 rounded-full bg-primary"
                style={{
                  width: `${Math.max(0, Math.min(100, entry.percentage))}%`,
                }}
              />
            </View>
          </>
        )}
        {trend.aminoAcidProfile === undefined ? null : (
          <AppText variant="caption" className="text-muted">
            Based on {trend.aminoAcidProfile.recordedDayCount} recorded days.
          </AppText>
        )}
        <AppText variant="caption" className="text-muted">
          This state is based on recorded Leucine values only; missing nutrient
          values remain gaps.
        </AppText>
      </AppCard>
    </View>
  );
}
