import type { ReportsResponse } from '@food-tracker/shared';
import { useWindowDimensions, View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { ReportingSectionHeading } from './reporting-section-heading';
import {
  highlightedNutrientEntries,
  nutrientPresentation,
} from '@/lib/reporting-ui';

export function HighlightedNutrientSummary({
  report,
  title = 'Nutrient highlights',
  setupComplete = true,
}: {
  report: Pick<ReportsResponse['current'], 'nutrientDetails'>;
  title?: string;
  setupComplete?: boolean;
}) {
  const { width } = useWindowDimensions();
  const entries = highlightedNutrientEntries(report);
  const contentWidth = Math.min(width - 40, 440);
  const small = width <= 340;
  const halfWidth = (contentWidth - 12) / 2;
  const thirdWidth = (contentWidth - 24) / 3;

  return (
    <View className="gap-3">
      <ReportingSectionHeading icon="nutrients" title={title} />
      <View className="flex-row flex-wrap gap-3">
        {entries.map(({ key, displayName, detail }) => {
          const presentation = nutrientPresentation({
            key,
            detail,
            report,
            setupComplete,
          });
          const cardWidth = small
            ? key === 'sodium'
              ? contentWidth
              : halfWidth
            : thirdWidth;
          return (
            <AppCard
              key={key}
              elevated
              compact
              accessible
              accessibilityLabel={`${displayName}: ${presentation.totalLabel}; ${presentation.statusLabel}`}
              className="gap-2 rounded-[18px]"
              style={{ width: cardWidth, minHeight: 112 }}
            >
              <AppText variant="caption" className="text-[13px] text-ink">
                {displayName}
              </AppText>
              <AppText
                variant="label"
                className="text-[18px] leading-6 text-ink tabular-nums"
              >
                {presentation.totalLabel}
              </AppText>
              <AppText variant="caption" className="text-muted">
                {presentation.statusLabel}
              </AppText>
            </AppCard>
          );
        })}
      </View>
    </View>
  );
}
