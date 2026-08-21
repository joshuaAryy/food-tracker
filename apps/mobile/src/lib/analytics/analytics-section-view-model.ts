import type {
  AnalyticsOverviewDataByKey,
  AnalyticsOverviewKey,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from './analytics-report-resource';

export type AnalyticsSectionViewStatus =
  | 'available'
  | 'pending'
  | 'stale'
  | 'unavailable';

export interface AnalyticsSectionViewModel<T> {
  data: T | null;
  status: AnalyticsSectionViewStatus;
  error: string | null;
  retryable: boolean;
}

export function analyticsSectionViewModel(
  state: AnalyticsReportSectionState | undefined,
): AnalyticsSectionViewModel<CanonicalTrendResponse> {
  return {
    data: state?.data ?? null,
    status: state?.status ?? 'unavailable',
    error: state?.error ?? null,
    retryable: state?.retryable ?? false,
  };
}

export function analyticsOverviewViewModel<K extends AnalyticsOverviewKey>(
  state: AnalyticsReportOverviewState<K> | undefined,
): AnalyticsSectionViewModel<AnalyticsOverviewDataByKey[K]> {
  return {
    data: state?.data ?? null,
    status: state?.status ?? 'unavailable',
    error: state?.error ?? null,
    retryable: state?.retryable ?? false,
  };
}
