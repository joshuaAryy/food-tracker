import type { ReportsResponse } from '@food-tracker/shared';
import { CalendarCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { reportWindowTitle } from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

function valueOrDash(value: number | null): string {
  return value === null ? '—' : Math.round(value).toLocaleString('en-US');
}

export function FullPeriodReport({
  report,
  period,
}: {
  report: ReportsResponse['previousCompleted'];
  period: ReportsResponse['period'];
}) {
  return (
    <AppCard compact className="gap-3">
      <View className="flex-row items-center gap-2">
        <CalendarCheck color={colors.light.muted} size={18} strokeWidth={2.2} />
        <View className="min-w-0 flex-1">
          <AppText variant="heading" className="text-ink">
            {reportWindowTitle(period, 'previous', report.boundaries)}
          </AppText>
          <AppText variant="caption" className="text-muted">
            Completed period, shown separately from the elapsed comparison.
          </AppText>
        </View>
      </View>
      <View className="flex-row gap-3 border-t border-line pt-3">
        <View className="min-w-0 flex-1">
          <AppText variant="caption" className="text-muted">
            Logged days
          </AppText>
          <AppText variant="number" className="text-ink">
            {report.loggedDays}
          </AppText>
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="caption" className="text-muted">
            Average energy
          </AppText>
          <AppText variant="number" className="text-ink">
            {valueOrDash(report.averageCalories)}
          </AppText>
          <AppText variant="caption" className="text-muted">
            kcal / logged day
          </AppText>
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="caption" className="text-muted">
            Average protein
          </AppText>
          <AppText variant="number" className="text-ink">
            {valueOrDash(report.averageProteinGrams)}
          </AppText>
          <AppText variant="caption" className="text-muted">
            g / logged day
          </AppText>
        </View>
      </View>
      {report.consistency.available ? (
        <AppText
          variant="caption"
          className="border-t border-line pt-3 text-muted"
        >
          {report.consistency.value.percentage}% consistency across{' '}
          {report.consistency.value.eligibleDays} eligible days.
        </AppText>
      ) : null}
    </AppCard>
  );
}
