import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import type { AnalyticsMetricDataSummaryState } from '@food-tracker/shared';

export function NutrientDataState({
  metricName,
  unit = 'mg',
  state,
  recorded,
  total,
}: {
  metricName: string;
  unit?: string;
  state: AnalyticsMetricDataSummaryState;
  recorded: number;
  total: number;
}) {
  if (state === 'sparse') {
    return null;
  }
  const title =
    state === 'no_food_logs'
      ? 'No nutrition data yet'
      : state === 'not_recorded'
        ? `No recorded ${metricName} data`
        : state === 'recorded_zero'
          ? `0 ${unit} recorded`
          : 'Recorded nutrient data';
  const description =
    state === 'no_food_logs'
      ? 'Log food to begin building this nutrient trend.'
      : state === 'not_recorded'
        ? `Your logged foods did not provide ${metricName} values for this period.`
        : state === 'recorded_zero'
          ? 'This nutrient field was present in your logged foods and the recorded total was zero.'
          : `${recorded} of ${total} logged days contain recorded ${metricName} values.`;
  return (
    <AppCard className="gap-3 p-4">
      <AppText variant="caption" className="font-bold uppercase text-muted">
        {state.replaceAll('_', ' ')}
      </AppText>
      <AppText variant="heading" className="text-[20px] leading-7">
        {title}
      </AppText>
      <AppText variant="caption" className="text-muted">
        {description}
      </AppText>
    </AppCard>
  );
}
