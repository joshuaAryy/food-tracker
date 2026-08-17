import { View } from 'react-native';
import { MacroChart } from '@/components/analytics/charts/macro-chart';
import { AppText } from '@/components/app-text';
import { formatMetricValue } from '@/lib/reporting-ui';

const macroLegend = [
  { key: 'protein', label: 'Protein', color: '#C9242D' },
  { key: 'carbs', label: 'Carbohydrates', color: '#33B866' },
  { key: 'fat', label: 'Fat', color: '#FFAD8F' },
] as const;

export function MacroBalanceSummary({
  percentages,
  size,
  averageEnergy,
}: {
  percentages: {
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  size: number;
  averageEnergy?: number | null;
}) {
  return (
    <View className="flex-row items-center gap-4">
      <MacroChart
        values={percentages}
        accessibilityLabel="Canonical macro composition"
        size={size}
        centerValue={
          averageEnergy === null || averageEnergy === undefined
            ? undefined
            : formatMetricValue(averageEnergy, { maximumFractionDigits: 0 })
        }
        centerLabel="kcal avg"
      />
      <View className="min-w-0 flex-1 gap-3">
        {macroLegend.map((item) => (
          <View
            key={item.key}
            testID={`macro-legend-${item.key}`}
            className="flex-row items-center justify-between gap-3"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <AppText variant="caption" numberOfLines={1}>
                {item.label}
              </AppText>
            </View>
            <AppText variant="caption" className="font-semibold tabular-nums">
              {formatMetricValue(percentages[item.key])}%
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
