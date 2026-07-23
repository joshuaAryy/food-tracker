import type { ReportsResponse } from '@food-tracker/shared';
import { Flame } from 'lucide-react-native';
import { View } from 'react-native';
import { AppText } from './app-text';
import { energyStatusLabel } from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

function formatEnergy(value: number | null, hasData: boolean): string {
  if (!hasData || value === null) return '—';
  return `${Math.round(value).toLocaleString('en-US')} kcal`;
}

function formatRange(
  range: ReportsResponse['current']['acceptedCalorieRange'] | null,
): string {
  if (range === null || range === undefined) return '—';
  return `${Math.round(range.lowerCalories).toLocaleString('en-US')}–${Math.round(range.upperCalories).toLocaleString('en-US')} kcal accepted range`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
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
  const difference =
    !hasData || target === null ? null : target - report.averageCalories;
  const span =
    range === null
      ? null
      : Math.max(
          range.upperCalories - range.lowerCalories,
          Math.round((target ?? range.upperCalories) * 0.25),
        );
  const minimum =
    range === null || span === null ? 0 : range.lowerCalories - span;
  const maximum =
    range === null || span === null ? 1 : range.upperCalories + span;
  const marker =
    !hasData || maximum <= minimum
      ? 0
      : clamp((report.averageCalories - minimum) / (maximum - minimum));
  const rangeStart =
    range === null || maximum <= minimum
      ? 0
      : clamp((range.lowerCalories - minimum) / (maximum - minimum));
  const rangeWidth =
    range === null || maximum <= minimum
      ? 0
      : clamp(
          (range.upperCalories - range.lowerCalories) / (maximum - minimum),
        );

  return (
    <View className="gap-4 border-t border-line pt-5">
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

      <View className="gap-1">
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

      <View className="gap-2 border-t border-line pt-3">
        <View className="flex-row justify-between gap-3">
          <AppText variant="caption" className="text-muted">
            Accepted range
          </AppText>
          <AppText
            variant="caption"
            className="min-w-0 flex-1 text-right text-ink tabular-nums"
          >
            {formatRange(range)}
          </AppText>
        </View>
        {range === null ? null : (
          <View
            accessible
            accessibilityLabel={`Average energy rail, ${formatEnergy(report.averageCalories, hasData)}; ${formatRange(range)}`}
            className="gap-2"
          >
            <View className="relative h-3 overflow-hidden rounded-full bg-primary-soft">
              <View
                className="absolute bottom-0 top-0 rounded-full bg-sage-soft"
                style={{
                  left: `${rangeStart * 100}%`,
                  width: `${rangeWidth * 100}%`,
                }}
              />
              <View
                className="absolute -top-1 h-5 w-1.5 rounded-full bg-ink"
                style={{ left: `${marker * 100}%` }}
              />
            </View>
            <AppText variant="caption" className="text-muted">
              {formatRange(range)}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
