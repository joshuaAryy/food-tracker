import type { ReportsResponse } from '@food-tracker/shared';
import { Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { AppText } from './app-text';
import {
  nutrientDetailsForMode,
  nutrientPercentageAccessibilityLabel,
  nutrientPercentageLabel,
  nutrientRowCopy,
} from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

export function HighlightedNutrientSummary({
  report,
  title = 'Highlighted nutrients',
}: {
  report: Pick<ReportsResponse['current'], 'nutrientDetails'>;
  title?: string;
}) {
  const entries = nutrientDetailsForMode(report, 'simple');
  if (entries.length === 0) return null;

  return (
    <View className="gap-3 border-t border-line pt-5">
      <View className="flex-row items-center gap-2">
        <Sparkles color={colors.light.ink} size={18} strokeWidth={2.2} />
        <View className="min-w-0 flex-1">
          <AppText variant="heading" className="text-ink">
            {title}
          </AppText>
          <AppText variant="caption" className="text-muted">
            Only nutrients recorded in this period are shown.
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
                  {detail.displayName}
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
