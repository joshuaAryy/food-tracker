import { Pressable, View } from 'react-native';
import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { NutrientReferenceSummary } from './nutrient-reference-summary';
import { formatMetricWithUnit } from '@/lib/reporting-ui';

export function RelatedMetricCard({
  name,
  trend,
  error,
  onOpen,
  presentation = 'default',
}: {
  name: string;
  trend: CanonicalTrendResponse | null;
  error: string | null;
  onOpen: () => void;
  presentation?: 'default' | 'nutrient-detail';
}) {
  const showReference = presentation === 'default';
  return (
    <AppCard
      testID="related-metric-card"
      className={
        presentation === 'nutrient-detail'
          ? 'gap-4 bg-surface p-[18px]'
          : trend === null
            ? 'gap-2'
            : 'gap-2 bg-module'
      }
    >
      <View className="flex-row items-center justify-between gap-3">
        <AppText
          variant="label"
          className={presentation === 'nutrient-detail' ? 'text-[16px]' : ''}
        >
          {name}
        </AppText>
        {trend === null ? null : (
          <AppText variant="caption" className="text-muted">
            {trend.summary.average === null
              ? 'Unknown'
              : `${formatMetricWithUnit(trend.summary.average, trend.reference.unit)} average`}
          </AppText>
        )}
      </View>
      {trend === null ? (
        <AppText variant="caption" className="text-muted">
          {error ?? 'Related metric unavailable'}
        </AppText>
      ) : !showReference ? null : (
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
        <AppText variant="caption" className="font-semibold text-[#5867C7]">
          Open paired view ›
        </AppText>
      </Pressable>
    </AppCard>
  );
}
