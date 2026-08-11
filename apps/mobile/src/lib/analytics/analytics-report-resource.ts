import type {
  AnalyticsSectionKey,
  AnalyticsSectionResult,
  CanonicalInsightsResponseV2,
  CanonicalTrendResponse,
} from '@food-tracker/shared';

export type AnalyticsReportResourceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'refreshing'
  | 'stale'
  | 'error';

export type AnalyticsReportSectionStatus =
  | 'available'
  | 'pending'
  | 'stale'
  | 'unavailable';

export interface AnalyticsReportSectionState {
  data: CanonicalTrendResponse | null;
  fetchedAt: string | null;
  status: AnalyticsReportSectionStatus;
  error: string | null;
  retryable: boolean;
}

export interface AnalyticsReportRetryIntent {
  kind: 'canonical_insights_request';
  section: AnalyticsSectionKey;
}

export interface AnalyticsReportResourceState {
  mode: CanonicalInsightsResponseV2['mode'] | null;
  period: CanonicalInsightsResponseV2['period'] | null;
  sections: Partial<Record<AnalyticsSectionKey, AnalyticsReportSectionState>>;
  updatedAt: number | null;
  status: AnalyticsReportResourceStatus;
  error: string | null;
  requestId: number;
  retry: AnalyticsReportRetryIntent | null;
}

export type AnalyticsReportResourceAction =
  | { type: 'load' | 'refresh'; requestId: number }
  | {
      type: 'hydrate';
      requestId: number;
      report: CanonicalInsightsResponseV2;
      updatedAt: number;
      stale: boolean;
    }
  | {
      type: 'commit';
      requestId: number;
      report: CanonicalInsightsResponseV2;
      updatedAt: number;
    }
  | { type: 'failure'; requestId: number }
  | { type: 'sectionRetry'; requestId: number; section: AnalyticsSectionKey };

const SECTION_ERROR_MESSAGE =
  'This analytics section is temporarily unavailable. Please try again.';
const REPORT_ERROR_MESSAGE =
  'Analytics are temporarily unavailable. Please try again.';

export function safeAnalyticsSectionError(
  result: Extract<AnalyticsSectionResult, { status: 'failed' }>,
): string {
  void result;
  return SECTION_ERROR_MESSAGE;
}

export function initialAnalyticsReportResource(): AnalyticsReportResourceState {
  return {
    mode: null,
    period: null,
    sections: {},
    updatedAt: null,
    status: 'idle',
    error: null,
    requestId: 0,
    retry: null,
  };
}

function hasCommittedSection(state: AnalyticsReportResourceState): boolean {
  return Object.values(state.sections).some(
    (section) => section?.data !== null,
  );
}

function pendingSections(
  sections: AnalyticsReportResourceState['sections'],
): AnalyticsReportResourceState['sections'] {
  return Object.fromEntries(
    Object.entries(sections).map(([key, section]) => [
      key,
      section?.data === null || section?.data === undefined
        ? section
        : { ...section, status: 'pending' as const, error: null },
    ]),
  ) as AnalyticsReportResourceState['sections'];
}

function sectionState(
  result: AnalyticsSectionResult,
  prior: AnalyticsReportSectionState | undefined,
  stale: boolean,
): AnalyticsReportSectionState {
  if (result.status === 'available') {
    return {
      data: result.data,
      fetchedAt: result.fetchedAt,
      status: stale ? 'stale' : 'available',
      error: null,
      retryable: false,
    };
  }

  const error = safeAnalyticsSectionError(result);
  return prior?.data === null || prior?.data === undefined
    ? {
        data: null,
        fetchedAt: null,
        status: 'unavailable',
        error,
        retryable: result.retryable,
      }
    : {
        ...prior,
        status: 'stale',
        error,
        retryable: result.retryable,
      };
}

function mergeReport(
  state: AnalyticsReportResourceState,
  report: CanonicalInsightsResponseV2,
  updatedAt: number,
  stale: boolean,
): AnalyticsReportResourceState {
  const sections = { ...state.sections };
  for (const [key, result] of Object.entries(report.sections)) {
    if (result === undefined) continue;
    sections[key as AnalyticsSectionKey] = sectionState(
      result,
      sections[key as AnalyticsSectionKey],
      stale,
    );
  }
  return {
    ...state,
    mode: report.mode,
    period: report.period,
    sections,
    updatedAt,
    status: stale ? 'stale' : 'ready',
    error: stale ? REPORT_ERROR_MESSAGE : null,
    retry: null,
  };
}

/** Keeps validated committed siblings visible across canonical whole-report refreshes. */
export function analyticsReportResourceReducer(
  state: AnalyticsReportResourceState,
  action: AnalyticsReportResourceAction,
): AnalyticsReportResourceState {
  switch (action.type) {
    case 'load':
    case 'refresh':
      return {
        ...state,
        sections: pendingSections(state.sections),
        requestId: action.requestId,
        status: hasCommittedSection(state) ? 'refreshing' : 'loading',
        error: null,
        retry: null,
      };
    case 'sectionRetry':
      return {
        ...state,
        sections: pendingSections(state.sections),
        requestId: action.requestId,
        status: hasCommittedSection(state) ? 'refreshing' : 'loading',
        error: null,
        retry: { kind: 'canonical_insights_request', section: action.section },
      };
    case 'commit':
      if (action.requestId !== state.requestId) return state;
      return mergeReport(state, action.report, action.updatedAt, false);
    case 'hydrate':
      if (state.requestId !== 0 && action.requestId !== state.requestId) {
        return state;
      }
      return {
        ...mergeReport(state, action.report, action.updatedAt, action.stale),
        requestId: action.requestId,
      };
    case 'failure':
      if (action.requestId !== state.requestId) return state;
      return hasCommittedSection(state)
        ? {
            ...state,
            status: 'stale',
            error: REPORT_ERROR_MESSAGE,
            retry: null,
          }
        : {
            ...state,
            status: 'error',
            error: REPORT_ERROR_MESSAGE,
            retry: null,
          };
  }
}
