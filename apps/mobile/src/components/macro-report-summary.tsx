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
  type NutrientPresentation,
} from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

const macroEntries = [
  ['protein', 'Protein'],
  ['carbs', 'Carbohydrates'],
  ['fat', 'Fat'],
] as const;

function MacroRow({
  keyName,
  label,
  presentation,
  detail,
  target,
}: {
  keyName: string;
  label: string;
  presentation: NutrientPresentation;
  detail: ReportingNutrientDetail | null;
  target: number | null | undefined;
}) {
  const showProteinRail =
    keyName === 'protein' &&
    detail !== null &&
    target !== null &&
    target !== undefined &&
    target > 0;
  const proteinRatio =
    showProteinRail && detail !== null && target !== null
      ? Math.min(1, Math.max(0, detail.averagePerLoggedDay / target))
      : 0;

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
        <AppText
          accessible
          accessibilityLabel={`${label}: ${presentation.statusLabel}`}
          variant="label"
          className="max-w-[126px] pt-0.5 text-right text-ink tabular-nums"
        >
          {presentation.statusLabel}
        </AppText>
      </View>
      {showProteinRail ? (
        <View
          accessible
          accessibilityLabel={`${label} average progress, ${presentation.statusLabel}`}
          className="h-2 overflow-hidden rounded-full bg-primary-soft"
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${proteinRatio * 100}%`,
              backgroundColor: colors.light.loggedProgress,
            }}
          />
        </View>
      ) : null}
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
              keyName={key}
              label={label}
              presentation={presentation}
              detail={detail}
              target={key === 'protein' ? report.proteinTargetGrams : null}
            />
          );
        })}
      </AppCard>
    </View>
  );
}
