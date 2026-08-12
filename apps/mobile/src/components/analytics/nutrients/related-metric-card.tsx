import { Pressable, View } from 'react-native';
import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { NutrientReferenceSummary } from './nutrient-reference-summary';

export function RelatedMetricCard({
  name,
  trend,
  error,
  onOpen,
}: {
  name: string;
  trend: CanonicalTrendResponse | null;
  error: string | null;
  onOpen: () => void;
}) {
  return (
    <AppCard
      elevated={trend !== null}
      className={trend === null ? 'gap-2' : 'gap-2 bg-module'}
    >
      <View className="flex-row items-center justify-between gap-3">
        <AppText variant="label">{name}</AppText>
        {trend === null ? null : (
          <AppText variant="caption" className="text-muted">
            {trend.summary.average === null
              ? 'Unknown'
              : `${trend.summary.average.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${trend.reference.unit} average`}
          </AppText>
        )}
      </View>
      {trend === null ? (
        <AppText variant="caption" className="text-muted">
          {error ?? 'Related metric unavailable'}
        </AppText>
      ) : (
        <NutrientReferenceSummary reference={trend.reference} />
      )}
      {trend === null ? (
        <AppText variant="caption" className="text-muted">
          Primary nutrient remains available.
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${name} paired view`}
        className="min-h-11 justify-center self-start"
        onPress={onOpen}
      >
        <AppText variant="caption" className="font-semibold text-primary-dark">
          Open paired view ›
        </AppText>
      </Pressable>
    </AppCard>
  );
}
