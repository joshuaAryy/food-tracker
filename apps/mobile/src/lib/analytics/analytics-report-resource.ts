import {
  ANALYTICS_INSIGHTS_SECTION_KEYS,
  type AnalyticsSectionKey,
  type AnalyticsSectionResult,
  type CanonicalInsightsResponseV2,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';

export type AnalyticsReportRequestKind =
  | 'none'
  | 'initial_load'
  | 'canonical_refresh'
  | 'section_retry';

export type AnalyticsReportRequestPhase =
  | 'idle'
  | 'pending'
  | 'cache_hydrated'
  | 'network_committed'
  | 'network_failed';

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
  staleSource: 'offline_cache' | 'refresh_failed' | null;
  error: string | null;
  requestId: number;
  retry: AnalyticsReportRetryIntent | null;
  requestKind: AnalyticsReportRequestKind;
  requestPhase: AnalyticsReportRequestPhase;
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
const REPORT_UNAVAILABLE_MESSAGE =
  'Analytics are temporarily unavailable. Please try again.';
const REPORT_REFRESH_FAILED_MESSAGE =
  "Couldn't refresh analytics. Showing earlier data.";
const REPORT_OFFLINE_MESSAGE = 'Offline. Showing saved analytics.';

const OMITTED_SECTION_RESULT = {
  status: 'failed',
  code: 'section_unavailable',
  retryable: true,
} as const satisfies Extract<AnalyticsSectionResult, { status: 'failed' }>;

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
    staleSource: null,
    error: null,
    requestId: 0,
    retry: null,
    requestKind: 'none',
    requestPhase: 'idle',
  };
}

function hasCommittedSection(state: AnalyticsReportResourceState): boolean {
  return Object.values(state.sections).some(
    (section) => section !== undefined && section.data !== null,
  );
}

function pendingSections(
  sections: AnalyticsReportResourceState['sections'],
): AnalyticsReportResourceState['sections'] {
  return Object.fromEntries(
    Object.entries(sections).map(([key, section]) => [
      key,
      pendingSection(section),
    ]),
  ) as AnalyticsReportResourceState['sections'];
}

function pendingSection(
  section: AnalyticsReportSectionState | undefined,
): AnalyticsReportSectionState {
  return {
    data: section?.data ?? null,
    fetchedAt: section?.fetchedAt ?? null,
    status: 'pending',
    error: null,
    retryable: false,
  };
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
  const sections: AnalyticsReportResourceState['sections'] = {};
  const expectedKeys = new Set<AnalyticsSectionKey>([
    ...ANALYTICS_INSIGHTS_SECTION_KEYS,
    ...(Object.keys(state.sections) as AnalyticsSectionKey[]),
    ...(Object.keys(report.sections) as AnalyticsSectionKey[]),
  ]);
  for (const key of expectedKeys) {
    sections[key] = sectionState(
      report.sections[key] ?? OMITTED_SECTION_RESULT,
      state.sections[key],
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
    staleSource: stale ? 'offline_cache' : null,
    error: stale ? REPORT_OFFLINE_MESSAGE : null,
    retry: null,
  };
}

function settleReportFailure(
  state: AnalyticsReportResourceState,
): AnalyticsReportResourceState['sections'] {
  return Object.fromEntries(
    Object.entries(state.sections).map(([key, section]) => [
      key,
      section?.data === null || section?.data === undefined
        ? {
            data: null,
            fetchedAt: null,
            status: 'unavailable' as const,
            error: SECTION_ERROR_MESSAGE,
            retryable: true,
          }
        : {
            ...section,
            status: 'stale' as const,
            error: REPORT_REFRESH_FAILED_MESSAGE,
            retryable: true,
          },
    ]),
  ) as AnalyticsReportResourceState['sections'];
}

/** Keeps validated committed siblings visible across canonical whole-report refreshes. */
export function analyticsReportResourceReducer(
  state: AnalyticsReportResourceState,
  action: AnalyticsReportResourceAction,
): AnalyticsReportResourceState {
  switch (action.type) {
    case 'load':
      return {
        ...state,
        sections: pendingSections(state.sections),
        requestId: action.requestId,
        status: hasCommittedSection(state) ? 'refreshing' : 'loading',
        staleSource: null,
        error: null,
        retry: null,
        requestKind: 'initial_load',
        requestPhase: 'pending',
      };
    case 'refresh':
      return {
        ...state,
        sections: pendingSections(state.sections),
        requestId: action.requestId,
        status: hasCommittedSection(state) ? 'refreshing' : 'loading',
        staleSource: null,
        error: null,
        retry: null,
        requestKind: 'canonical_refresh',
        requestPhase: 'pending',
      };
    case 'sectionRetry':
      return {
        ...state,
        sections: {
          ...state.sections,
          [action.section]: pendingSection(state.sections[action.section]),
        },
        requestId: action.requestId,
        status: hasCommittedSection(state) ? 'refreshing' : 'loading',
        staleSource: null,
        error: null,
        retry: { kind: 'canonical_insights_request', section: action.section },
        requestKind: 'section_retry',
        requestPhase: 'pending',
      };
    case 'commit':
      if (action.requestId !== state.requestId) return state;
      return {
        ...mergeReport(state, action.report, action.updatedAt, false),
        requestPhase: 'network_committed',
      };
    case 'hydrate': {
      const isInitialFallback =
        state.requestKind === 'initial_load' &&
        (state.requestPhase === 'pending' ||
          state.requestPhase === 'network_failed' ||
          state.requestPhase === 'cache_hydrated') &&
        (!hasCommittedSection(state) || state.staleSource === 'offline_cache');
      const hasHydratedCache =
        state.requestPhase === 'cache_hydrated' ||
        state.staleSource === 'offline_cache';
      const isNewerCacheValue =
        !hasHydratedCache ||
        state.updatedAt === null ||
        action.updatedAt > state.updatedAt;
      if (
        action.requestId !== state.requestId ||
        !isInitialFallback ||
        !isNewerCacheValue
      ) {
        return state;
      }
      return {
        ...mergeReport(state, action.report, action.updatedAt, action.stale),
        requestId: action.requestId,
        requestKind: 'initial_load',
        requestPhase: 'cache_hydrated',
      };
    }
    case 'failure': {
      if (action.requestId !== state.requestId) return state;
      if (state.requestPhase === 'network_committed') return state;

      if (state.requestKind === 'section_retry' && state.retry !== null) {
        const target = state.retry.section;
        const sections = {
          ...state.sections,
          [target]: sectionState(
            OMITTED_SECTION_RESULT,
            state.sections[target],
            false,
          ),
        };
        return hasCommittedSection(state)
          ? {
              ...state,
              sections,
              status: 'ready',
              staleSource: null,
              error: null,
              retry: null,
              requestPhase: 'network_failed',
            }
          : {
              ...state,
              sections,
              status: 'error',
              staleSource: null,
              error: REPORT_UNAVAILABLE_MESSAGE,
              retry: null,
              requestPhase: 'network_failed',
            };
      }

      if (
        state.requestKind === 'initial_load' &&
        state.staleSource === 'offline_cache'
      ) {
        return {
          ...state,
          requestPhase: 'network_failed',
        };
      }

      const sections = settleReportFailure(state);
      return hasCommittedSection(state)
        ? {
            ...state,
            sections,
            status: 'stale',
            staleSource: 'refresh_failed',
            error: REPORT_REFRESH_FAILED_MESSAGE,
            retry: null,
            requestPhase: 'network_failed',
          }
        : {
            ...state,
            sections,
            status: 'error',
            staleSource: null,
            error: REPORT_UNAVAILABLE_MESSAGE,
            retry: null,
            requestPhase: 'network_failed',
          };
    }
  }
}
