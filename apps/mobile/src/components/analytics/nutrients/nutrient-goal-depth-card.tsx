import type { AnalyticsReference } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { NutrientReferenceSummary } from './nutrient-reference-summary';

function formatValue(value: number | null, unit: string): string {
  return value === null
    ? 'Unknown'
    : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`;
}

function visualDepth(
  average: number | null,
  reference: AnalyticsReference,
): number | null {
  if (average === null) return null;
  if (reference.kind === 'target' || reference.kind === 'minimum') {
    return Math.max(0, Math.min(1, average / reference.value));
  }
  if (reference.kind === 'limit') {
    return Math.max(0, Math.min(1, average / reference.value));
  }
  if (reference.kind === 'range') {
    return Math.max(
      0,
      Math.min(
        1,
        (average - reference.lower) / (reference.upper - reference.lower),
      ),
    );
  }
  return null;
}

export function NutrientGoalDepthCard({
  metricName,
  unit,
  average,
  reference,
  metricCoverage,
}: {
  metricName: string;
  unit: string;
  average: number | null;
  reference: AnalyticsReference;
  metricCoverage: {
    recorded: number;
    partial: number;
    unknown: number;
  };
}) {
  const depth = visualDepth(average, reference);
  return (
    <AppCard elevated className="gap-3 p-4">
      <View className="flex-row items-center justify-between gap-3">
        <AppText variant="label">{metricName}</AppText>
        <AppText variant="caption" className="text-muted">
          {formatValue(average, unit)}
        </AppText>
      </View>
      <NutrientReferenceSummary reference={reference} />
      {depth === null ? null : (
        <View
          accessible
          accessibilityLabel={`${metricName} reference depth ${Math.round(depth * 100)} percent`}
          className="h-2 overflow-hidden rounded-full bg-border"
        >
          <View
            className="h-2 rounded-full bg-primary"
            style={{ width: `${Math.round(depth * 100)}%` }}
          />
        </View>
      )}
      <AppText variant="caption" className="text-muted">
        {metricCoverage.recorded} recorded · {metricCoverage.unknown} unknown
        metric days
      </AppText>
    </AppCard>
  );
}
