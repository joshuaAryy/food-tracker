import type { AnalyticsForecast } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ForecastChart } from '@/components/analytics/charts/forecast-chart';
import { ForecastUnavailableCard } from './forecast-unavailable-card';
import { formatPresentationDate } from '@/lib/date-time';
import { formatMetricValue } from '@/lib/reporting-ui';

export function CaloriesForecastCard({
  forecast,
  historical = [],
  width = 300,
}: {
  forecast: AnalyticsForecast | undefined;
  historical?: readonly (number | null)[];
  width?: number;
}) {
  if (forecast?.kind === 'available') {
    const last = forecast.points.at(-1);
    return (
      <AppCard elevated className="gap-1 p-[18px]">
        <AppText variant="label">Calorie forecast</AppText>
        <AppText variant="caption" className="text-muted">
          Seven-day projection after{' '}
          {formatPresentationDate(forecast.todayDate, { includeYear: true })}.
        </AppText>
        {last === undefined ? null : (
          <AppText
            variant="heading"
            className="text-[20px] leading-7 tabular-nums"
          >
            {formatMetricValue(last.lower, { maximumFractionDigits: 0 })}–
            {formatMetricValue(last.upper, { maximumFractionDigits: 0 })} kcal
          </AppText>
        )}
        <ForecastChart
          historical={historical}
          forecast={forecast.points}
          width={width}
          accessibilityLabel="Calories forecast"
        />
      </AppCard>
    );
  }
  if (forecast?.kind !== 'unavailable') return null;
  return <ForecastUnavailableCard metric="calories" />;
}
