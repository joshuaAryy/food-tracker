import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

export function ForecastUnavailableCard({
  metric,
}: {
  metric: 'calories' | 'weight';
}) {
  const title = metric === 'calories' ? 'Calorie forecast' : 'Weight forecast';
  return (
    <AppCard
      testID={`${metric}-forecast-unavailable`}
      elevated
      className="gap-3 p-[18px]"
    >
      <AppText variant="label">{title}</AppText>
      <AppText variant="heading" className="text-[23px] leading-8">
        Not enough recent data
      </AppText>
      <AppText className="text-muted">
        A forecast needs enough recent complete-day coverage to backtest a
        stable short-term model. Your recorded history stays visible; no future
        line is fabricated.
      </AppText>
      <AppText variant="caption" className="text-muted">
        Another valid unavailable state: recent{' '}
        {metric === 'calories' ? 'intake' : 'weight'} is too variable for a
        useful projection.
      </AppText>
    </AppCard>
  );
}
