import type { ReportsResponse } from '@food-tracker/shared';
import { Flame } from 'lucide-react-native';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { RadialProgressRing } from './radial-progress-ring';
import { energyStatusLabel } from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

function formatEnergy(value: number | null, hasData: boolean): string {
  if (!hasData || value === null) return '—';
  return `${Math.round(value).toLocaleString('en-US')} kcal`;
}

function formatRange(
  range: ReportsResponse['current']['acceptedCalorieRange'] | null,
): string {
  if (range === null || range === undefined) return 'Target range unavailable';
  return `${Math.round(range.lowerCalories).toLocaleString('en-US')}–${Math.round(range.upperCalories).toLocaleString('en-US')} kcal accepted range`;
}

export function EnergyReportSummary({
  report,
  title = 'Energy balance',
}: {
  report: Omit<ReportsResponse['current'], 'streak'>;
  title?: string;
}) {
  const hasData = report.loggedDays > 0;
  const target = report.calorieTarget ?? null;
  const range = report.acceptedCalorieRange ?? null;
  const status =
    report.averageCalorieStatus ?? (hasData ? 'no_target' : 'no_data');
  const ratio =
    !hasData || target === null || target <= 0
      ? 0
      : Math.min(report.averageCalories / target, 1);
  const difference =
    !hasData || target === null ? null : target - report.averageCalories;

  return (
    <AppCard compact className="gap-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Flame color={colors.light.carbs} size={18} strokeWidth={2.2} />
          <AppText variant="heading" className="text-ink">
            {title}
          </AppText>
        </View>
        <AppText variant="caption" className="text-muted">
          {energyStatusLabel(status)}
        </AppText>
      </View>

      <View className="flex-row items-center gap-5">
        <RadialProgressRing
          progress={ratio}
          size={92}
          strokeWidth={9}
          progressColor={colors.light.carbs}
          trackColor={colors.light.carbsSoft}
          accessibilityLabel={`Average energy ${formatEnergy(report.averageCalories, hasData)} against a ${target === null ? 'missing' : `${Math.round(target)} kcal`} target`}
        >
          <AppText variant="label" className="text-ink tabular-nums">
            {hasData && target !== null
              ? `${Math.round((report.averageCalories / target) * 100)}%`
              : '—'}
          </AppText>
        </RadialProgressRing>
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="caption" className="text-muted">
            Average recorded per logged day
          </AppText>
          <AppText variant="number" className="text-ink">
            {formatEnergy(report.averageCalories, hasData)}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {difference === null
              ? 'Add a target to see remaining energy.'
              : difference >= 0
                ? `${Math.round(difference).toLocaleString('en-US')} kcal remaining to target`
                : `${Math.round(Math.abs(difference)).toLocaleString('en-US')} kcal above target`}
          </AppText>
        </View>
      </View>

      <View className="gap-2 border-t border-line pt-3">
        <View className="flex-row justify-between gap-3">
          <AppText variant="caption" className="text-muted">
            Target
          </AppText>
          <AppText variant="caption" className="text-ink tabular-nums">
            {target === null ? '—' : formatEnergy(target, true)}
          </AppText>
        </View>
        <AppText variant="caption" className="text-muted">
          {formatRange(range)}
        </AppText>
      </View>
    </AppCard>
  );
}
