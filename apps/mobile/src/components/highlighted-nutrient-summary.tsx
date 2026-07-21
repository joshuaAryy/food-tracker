import type { ReportsResponse } from '@food-tracker/shared';
import { Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { nutrientDetailsForMode } from '@/lib/reporting-ui';
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
    <AppCard compact className="gap-3">
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
        {entries.map(({ key, detail }) => (
          <View
            key={key}
            className="flex-row items-center gap-3 border-t border-line py-3"
          >
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.light.sageDark }}
            />
            <View className="min-w-0 flex-1 gap-0.5">
              <AppText variant="label" className="text-ink">
                {detail.displayName}
              </AppText>
              <AppText variant="caption" className="text-muted">
                Recorded on {detail.recordedDayCount}{' '}
                {detail.recordedDayCount === 1 ? 'day' : 'days'}
              </AppText>
            </View>
            <AppText variant="label" className="text-ink tabular-nums">
              {detail.averagePerLoggedDay.toLocaleString('en-US', {
                maximumFractionDigits: detail.unit === 'mg' ? 0 : 1,
              })}{' '}
              {detail.unit}
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}
