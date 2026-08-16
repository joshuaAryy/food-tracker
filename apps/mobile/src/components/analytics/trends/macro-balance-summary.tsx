import { View } from 'react-native';
import { MacroChart } from '@/components/analytics/charts/macro-chart';
import { AppText } from '@/components/app-text';
import { formatMetricValue } from '@/lib/reporting-ui';

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
      <View className="gap-2">
        <AppText>Protein · {formatMetricValue(percentages.protein)}%</AppText>
        <AppText>
          Carbohydrates · {formatMetricValue(percentages.carbs)}%
        </AppText>
        <AppText>Fat · {formatMetricValue(percentages.fat)}%</AppText>
      </View>
    </View>
  );
}
