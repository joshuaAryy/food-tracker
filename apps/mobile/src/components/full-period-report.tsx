import type { ReportsResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { ReportingSectionHeading } from './reporting-section-heading';
import {
  previousPeriodNoDataLabel,
  reportWindowTitle,
} from '@/lib/reporting-ui';

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
  const title = reportWindowTitle(period, 'previous', report.boundaries);

  return (
    <View className="gap-3">
      <ReportingSectionHeading
        icon="report"
        title="Previous full period"
        compact
        subtitle={title}
      />
      <AppCard elevated>
        {report.loggedDays === 0 ? (
          <AppText variant="caption" className="text-muted">
            {previousPeriodNoDataLabel(report.boundaries)}
          </AppText>
        ) : (
          <View className="flex-row gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <AppText variant="caption" className="text-muted">
                Logged days
              </AppText>
              <AppText variant="number" className="text-ink">
                {report.loggedDays}
              </AppText>
            </View>
            <View className="min-w-0 flex-1 gap-1">
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
            <View className="min-w-0 flex-1 gap-1">
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
        )}
      </AppCard>
    </View>
  );
}
