import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

function comparisonCopy(trend: CanonicalTrendResponse): string {
  const message = trend.interpretation?.message;
  if (message !== undefined && message !== null) return message;
  return 'Keep logging to make this period comparison more useful.';
}

export function CaloriesSummaryCard({
  trend,
  simple,
}: {
  trend: CanonicalTrendResponse;
  simple: boolean;
}) {
  return (
    <AppCard elevated className="gap-1 p-[18px]">
      <AppText variant="heading" className="text-[30px] leading-9 tabular-nums">
        {trend.summary.average === null
          ? 'Unknown'
          : `${trend.summary.average.toLocaleString('en-US', { maximumFractionDigits: 0 })} kcal`}
      </AppText>
      <AppText variant="caption" className="text-muted">
        {trend.summary.average === null
          ? 'No recorded values in this period.'
          : `Average ${trend.summary.average.toFixed(1)} kcal`}
      </AppText>
      {trend.summary.average === null ? null : (
        <AppText variant="caption" className="text-muted">
          Across {trend.summary.numericDayCount} recorded days
        </AppText>
      )}
      {simple ? null : (
        <AppText variant="caption" className="text-primary-dark">
          {comparisonCopy(trend)}
        </AppText>
      )}
    </AppCard>
  );
}
