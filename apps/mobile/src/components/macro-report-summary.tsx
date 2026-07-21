import type { ReportsResponse } from '@food-tracker/shared';
import { Beef, Circle } from 'lucide-react-native';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { proteinAdherenceStatus } from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

const macroColors = {
  protein: colors.light.sageDark,
  carbs: colors.light.carbs,
  fat: colors.light.fat,
} as const;

function formatAmount(value: number, unit: string): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: unit === 'mg' ? 0 : 1 })} ${unit}`;
}

export function MacroReportSummary({
  report,
  title = 'Macros',
}: {
  report: Omit<ReportsResponse['current'], 'streak'>;
  title?: string;
}) {
  const details = report.nutrientDetails ?? {};
  const entries = (['protein', 'carbs', 'fat'] as const).flatMap((key) => {
    const detail = details[key];
    return detail === undefined ? [] : [{ key, detail }];
  });
  if (entries.length === 0) return null;

  const total = entries.reduce(
    (sum, entry) => sum + entry.detail.averagePerLoggedDay,
    0,
  );

  return (
    <AppCard compact className="gap-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Beef color={colors.light.sageDark} size={18} strokeWidth={2.2} />
          <AppText variant="heading" className="text-ink">
            {title}
          </AppText>
        </View>
        <AppText variant="caption" className="text-muted">
          Average per logged day
        </AppText>
      </View>

      <View className="gap-3">
        {entries.map(({ key, detail }) => {
          const target =
            key === 'protein' ? (report.proteinTargetGrams ?? null) : null;
          const fraction =
            target !== null && target > 0
              ? Math.min(detail.averagePerLoggedDay / target, 1)
              : total <= 0
                ? 0
                : detail.averagePerLoggedDay / total;
          const targetLabel =
            target === null
              ? `${Math.round(fraction * 100)}% of logged macros`
              : (proteinAdherenceStatus(report.proteinAdherence) ??
                `${Math.round(target)} g target`);
          return (
            <View key={key} className="gap-2">
              <View className="flex-row items-end justify-between gap-3">
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  <Circle
                    color={macroColors[key]}
                    fill={macroColors[key]}
                    size={9}
                  />
                  <AppText variant="label" className="text-ink">
                    {key === 'protein'
                      ? 'Protein priority'
                      : key === 'carbs'
                        ? 'Carbohydrates'
                        : 'Fat'}
                  </AppText>
                </View>
                <AppText variant="label" className="text-ink tabular-nums">
                  {formatAmount(detail.averagePerLoggedDay, detail.unit)}
                </AppText>
              </View>
              <View
                className="h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: `${macroColors[key]}28` }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, Math.min(fraction, 1) * 100)}%`,
                    backgroundColor: macroColors[key],
                  }}
                />
              </View>
              <AppText variant="caption" className="text-muted">
                {targetLabel} · recorded on {detail.recordedDayCount}{' '}
                {detail.recordedDayCount === 1 ? 'day' : 'days'}
              </AppText>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
}
