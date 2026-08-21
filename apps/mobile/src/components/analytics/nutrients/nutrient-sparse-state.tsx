import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

export function NutrientSparseState({
  metricName,
  recorded,
  total,
}: {
  metricName: string;
  recorded: number;
  total: number;
}) {
  return (
    <AppCard className="gap-3 p-4">
      <AppText variant="caption" className="font-bold uppercase text-primary">
        Sparse coverage
      </AppText>
      <AppText variant="heading" className="text-[20px] leading-7">
        Sparse nutrient coverage
      </AppText>
      <AppText variant="caption" className="text-muted">
        {metricName} values were available on {recorded} of {total} logged days.
      </AppText>
      <AppText variant="caption" className="text-muted">
        The chart preserves gaps and avoids treating unknown values as zero.
      </AppText>
      <AppText variant="caption" className="font-semibold text-primary">
        Trend confidence: limited
      </AppText>
    </AppCard>
  );
}
