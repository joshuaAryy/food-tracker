import { View } from 'react-native';
import { NUTRIENT_CATALOG } from '@food-tracker/shared';
import type {
  NormalizedNutrientKey,
  RecipeNutritionSummarySnapshot,
  TrackingMode,
} from '@food-tracker/shared';
import { AppCard } from './app-card';
import { AppText } from './app-text';

function optionalGrams(value: number | null): string | null {
  return value === null ? null : `${value.toFixed(1)} g`;
}

export function RecipeNutritionSummary({
  title,
  summary,
  mode,
}: {
  title: string;
  summary: RecipeNutritionSummarySnapshot;
  mode: TrackingMode;
}) {
  const nutrition = summary.materialized;
  const primary = [
    ['Protein', optionalGrams(nutrition.protein)],
    ['Carbs', optionalGrams(nutrition.carbs)],
    ['Fat', optionalGrams(nutrition.fat)],
    ['Fiber', optionalGrams(nutrition.fiber)],
  ].filter((entry): entry is [string, string] => entry[1] !== null);
  const nutrients = Object.entries(nutrition.nutrients).sort(
    ([left], [right]) => left.localeCompare(right),
  );

  return (
    <AppCard compact className="gap-3">
      <View className="flex-row items-end justify-between gap-3">
        <AppText variant="label">{title}</AppText>
        <AppText variant="heading" className="tabular-nums">
          {nutrition.calories.toLocaleString()} kcal
        </AppText>
      </View>
      <View className="gap-1 border-t border-line pt-2">
        {primary.map(([label, value]) => (
          <View key={label} className="flex-row justify-between gap-3 py-1">
            <AppText variant="caption" muted>
              {label}
            </AppText>
            <AppText variant="caption" className="tabular-nums">
              {value}
            </AppText>
          </View>
        ))}
        {mode === 'complex'
          ? nutrients.map(([key, nutrient]) => (
              <View key={key} className="flex-row justify-between gap-3 py-1">
                <AppText variant="caption" muted>
                  {NUTRIENT_CATALOG[key as NormalizedNutrientKey]
                    ?.displayName ?? key}
                </AppText>
                <AppText variant="caption" className="tabular-nums">
                  {nutrient.amount} {nutrient.unit}
                </AppText>
              </View>
            ))
          : null}
      </View>
    </AppCard>
  );
}
