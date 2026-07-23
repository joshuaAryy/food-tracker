import type { ReportsResponse } from '@food-tracker/shared';
import { Beef } from 'lucide-react-native';
import { View } from 'react-native';
import { AppText } from './app-text';
import {
  nutrientPercentageAccessibilityLabel,
  nutrientPercentageLabel,
  nutrientRowCopy,
} from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

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

  return (
    <View className="gap-3 border-t border-line pt-5">
      <View className="flex-row items-center gap-2">
        <Beef color={colors.light.sageDark} size={18} strokeWidth={2.2} />
        <View className="min-w-0 flex-1">
          <AppText variant="heading" className="text-ink">
            {title}
          </AppText>
          <AppText variant="caption" className="text-muted">
            Totals from recorded nutrient details.
          </AppText>
        </View>
      </View>

      <View>
        {entries.map(({ key, detail }) => {
          const percentageInput = {
            key,
            average: detail.averagePerLoggedDay,
            report,
          };
          return (
            <View
              key={key}
              className="flex-row items-start gap-4 border-t border-line py-3"
            >
              <View className="min-w-0 flex-1 gap-0.5">
                <AppText variant="label" className="text-ink">
                  {key === 'protein'
                    ? 'Protein priority'
                    : key === 'carbs'
                      ? 'Carbohydrates'
                      : 'Fat'}
                </AppText>
                <AppText variant="caption" className="text-muted">
                  {nutrientRowCopy({ key, detail, report })}
                </AppText>
              </View>
              <AppText
                accessible
                accessibilityLabel={nutrientPercentageAccessibilityLabel(
                  percentageInput,
                )}
                variant="label"
                className="pt-0.5 text-ink tabular-nums"
              >
                {nutrientPercentageLabel(percentageInput)}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
