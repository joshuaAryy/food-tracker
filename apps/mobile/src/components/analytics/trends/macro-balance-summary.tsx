import { View } from 'react-native';
import { MacroChart } from '@/components/analytics/charts/macro-chart';
import { AppText } from '@/components/app-text';

export function MacroBalanceSummary({
  percentages,
  size,
}: {
  percentages: {
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  size: number;
}) {
  return (
    <>
      <MacroChart
        values={percentages}
        accessibilityLabel="Canonical macro composition"
        size={size}
      />
      <View className="gap-2">
        <AppText>Protein · {percentages.protein ?? 'Unknown'}%</AppText>
        <AppText>Carbohydrates · {percentages.carbs ?? 'Unknown'}%</AppText>
        <AppText>Fat · {percentages.fat ?? 'Unknown'}%</AppText>
      </View>
    </>
  );
}
