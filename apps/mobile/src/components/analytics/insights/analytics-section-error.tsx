import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from '@/lib/analytics/analytics-report-resource';
import type { AnalyticsOverviewKey } from '@food-tracker/shared';

type ReportGroupState =
  | AnalyticsReportSectionState
  | AnalyticsReportOverviewState<AnalyticsOverviewKey>;

export function AnalyticsSectionError({
  title,
  section,
  onRetry,
}: {
  title: string;
  section: ReportGroupState | undefined;
  onRetry: () => void;
}) {
  const retrying = section?.status === 'pending';
  const lowerTitle = title.toLocaleLowerCase('en-US');
  return (
    <AppCard elevated className="gap-3 p-[18px]">
      <AppText variant="heading" className="text-[20px] leading-7 text-ink">
        {title} couldn’t load
      </AppText>
      <AppText muted>
        Other Insights reports are still available. Retry only this report.
      </AppText>
      {retrying ? (
        <AppText variant="caption" className="text-muted">
          Retrying {lowerTitle}…
        </AppText>
      ) : null}
      <AppButton
        accessibilityLabel={`Retry ${lowerTitle}`}
        className="min-h-11 self-start rounded-[14px] px-5 py-2"
        onPress={onRetry}
      >
        Retry {lowerTitle}
      </AppButton>
    </AppCard>
  );
}
