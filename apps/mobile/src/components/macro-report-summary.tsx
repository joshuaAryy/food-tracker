import type {
  ReportsResponse,
  ReportingNutrientDetail,
} from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { ReportingSectionHeading } from './reporting-section-heading';
import {
  nutrientPresentation,
  nutrientPresentationAccessibilityLabel,
  type NutrientPresentation,
} from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

const macroEntries = [
  ['protein', 'Protein'],
  ['carbs', 'Carbohydrates'],
  ['fat', 'Fat'],
] as const;

function MacroRow({
  label,
  presentation,
  detail,
}: {
  label: string;
  presentation: NutrientPresentation;
  detail: ReportingNutrientDetail | null;
}) {
  const percentage = detail?.percentage;
  const progressRatio =
    percentage === null ||
    percentage === undefined ||
    !Number.isFinite(percentage)
      ? 0
      : Math.min(100, Math.max(0, percentage));

  return (
    <View className="gap-2 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="label" className="text-[16px] leading-6 text-ink">
            {label}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {detail === null
              ? presentation.totalLabel
              : `${presentation.totalLabel} total`}
          </AppText>
        </View>
        <View className="max-w-[150px] items-end gap-0.5">
          <AppText
            accessible
            accessibilityLabel={nutrientPresentationAccessibilityLabel({
              displayName: label,
              presentation,
            })}
            variant="label"
            className="text-right text-ink tabular-nums"
          >
            {presentation.statusLabel}
          </AppText>
          {presentation.goalMetadataLabel !== null ? (
            <AppText
              variant="caption"
              className="text-right text-muted tabular-nums"
            >
              {presentation.goalMetadataLabel}
            </AppText>
          ) : null}
        </View>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        className="h-2 overflow-hidden rounded-full bg-primary-soft"
      >
        <View
          className="h-full rounded-full"
          style={{
            width: `${progressRatio}%`,
            backgroundColor: colors.light.loggedProgress,
          }}
        />
      </View>
    </View>
  );
}

export function MacroReportSummary({
  report,
  title = 'Macro balance',
  setupComplete = true,
}: {
  report: Omit<ReportsResponse['current'], 'streak'>;
  title?: string;
  setupComplete?: boolean;
}) {
  const details = report.nutrientDetails ?? {};

  return (
    <View className="gap-3">
      <ReportingSectionHeading icon="macros" title={title} />
      <AppCard elevated>
        {macroEntries.map(([key, label]) => {
          const detail = details[key] ?? null;
          const presentation = nutrientPresentation({
            key,
            detail,
            report,
            setupComplete,
          });
          return (
            <MacroRow
              key={key}
              label={label}
              presentation={presentation}
              detail={detail}
            />
          );
        })}
      </AppCard>
    </View>
  );
}
