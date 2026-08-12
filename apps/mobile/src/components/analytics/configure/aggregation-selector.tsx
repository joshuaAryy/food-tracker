import { Pressable, View } from 'react-native';
import type { AnalyticsAggregation } from '@food-tracker/shared';
import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { SelectorRow } from './selector-row';

const descriptions: Record<AnalyticsAggregation, string> = {
  automatic: 'Uses daily, weekly, or monthly based on range length',
  daily: 'Most detail · available when density remains readable',
  weekly: 'Smooths longer periods into weekly buckets',
  monthly: 'Best for long historical ranges',
};

export function AggregationSelector({
  value,
  allowed,
  onSelect,
  onClose,
}: {
  value: AnalyticsAggregation;
  allowed: readonly AnalyticsAggregation[];
  onSelect: (value: AnalyticsAggregation) => void;
  onClose: () => void;
}) {
  return (
    <View testID="aggregation-selector" className="gap-5">
      <ScreenHeader
        title="Aggregation"
        subtitle="Control how a longer period is summarized. Automatic remains the recommended default."
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done with Aggregation"
            className="min-h-11 justify-center"
            onPress={onClose}
          >
            <AppText variant="label">Done</AppText>
          </Pressable>
        }
      />
      <View className="gap-2">
        {allowed.map((option) => (
          <SelectorRow
            key={option}
            label={option.charAt(0).toUpperCase() + option.slice(1)}
            description={descriptions[option]}
            selected={value === option}
            onPress={() => onSelect(option)}
          />
        ))}
      </View>
      <AppText variant="caption" className="text-muted">
        Automatic rules: 1–45 days → daily · 46–180 → weekly · 181+ → monthly.
        Unsupported overrides are disabled instead of degrading the chart.
      </AppText>
    </View>
  );
}
