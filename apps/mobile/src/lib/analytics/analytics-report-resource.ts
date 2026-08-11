import {
  ANALYTICS_INSIGHTS_SECTION_KEYS,
  ANALYTICS_OVERVIEW_KEYS,
  type AnalyticsOverviewDataByKey,
  type AnalyticsOverviewKey,
  type AnalyticsOverviewResult,
  type AnalyticsSectionKey,
  type AnalyticsSectionResult,
  type CanonicalInsightsResponseV2,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';

export type AnalyticsReportRequestKind =
  | 'none'
  | 'initial_load'
  | 'canonical_refresh'
  | 'section_retry'
  | 'overview_retry';

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

export type AnalyticsReportOverviewState<K extends AnalyticsOverviewKey> = {
  data: AnalyticsOverviewDataByKey[K] | null;
  fetchedAt: string | null;
  status: AnalyticsReportSectionStatus;
  error: string | null;
  retryable: boolean;
};

export type AnalyticsReportOverviewStateByKey = {
  [K in AnalyticsOverviewKey]: AnalyticsReportOverviewState<K>;
};

export type AnalyticsReportRetryIntent =
  | {
      kind: 'canonical_insights_request';
      target: 'section';
      section: AnalyticsSectionKey;
    }
  | {
      kind: 'canonical_insights_request';
      target: 'overview';
      overview: AnalyticsOverviewKey;
    };

export interface AnalyticsReportResourceState {
  mode: CanonicalInsightsResponseV2['mode'] | null;
  period: CanonicalInsightsResponseV2['period'] | null;
  sections: Partial<Record<AnalyticsSectionKey, AnalyticsReportSectionState>>;
  overview: Partial<AnalyticsReportOverviewStateByKey>;
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
  | { type: 'sectionRetry'; requestId: number; section: AnalyticsSectionKey }
  | {
      type: 'overviewRetry';
      requestId: number;
      overview: AnalyticsOverviewKey;
    };

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

const OMITTED_OVERVIEW_RESULT = OMITTED_SECTION_RESULT satisfies Extract<
  AnalyticsOverviewResult<never>,
  { status: 'failed' }
>;

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
    overview: {},
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

function hasCommittedData(state: AnalyticsReportResourceState): boolean {
  return (
    Object.values(state.sections).some(
      (section) => section !== undefined && section.data !== null,
    ) ||
    Object.values(state.overview).some(
      (overview) => overview !== undefined && overview.data !== null,
    )
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

function pendingOverviewGroup<K extends AnalyticsOverviewKey>(
  overview: AnalyticsReportOverviewState<K> | undefined,
): AnalyticsReportOverviewState<K> {
  return {
    data: overview?.data ?? null,
    fetchedAt: overview?.fetchedAt ?? null,
    status: 'pending',
    error: null,
    retryable: false,
  };
}

function pendingOverview(
  overview: AnalyticsReportResourceState['overview'],
): AnalyticsReportResourceState['overview'] {
  return Object.fromEntries(
    Object.entries(overview).map(([key, group]) => [
      key,
      pendingOverviewGroup(group),
    ]),
  ) as AnalyticsReportResourceState['overview'];
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

function overviewState<K extends AnalyticsOverviewKey>(
  result: AnalyticsOverviewResult<AnalyticsOverviewDataByKey[K]>,
  prior: AnalyticsReportOverviewState<K> | undefined,
  stale: boolean,
): AnalyticsReportOverviewState<K> {
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
  const overview: AnalyticsReportResourceState['overview'] = {};
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
  const expectedOverviewKeys = new Set<AnalyticsOverviewKey>([
    ...ANALYTICS_OVERVIEW_KEYS,
    ...(Object.keys(state.overview) as AnalyticsOverviewKey[]),
    ...(Object.keys(report.overview ?? {}) as AnalyticsOverviewKey[]),
  ]);
  // The runtime key comes from the validated v2 map. Keep the public state
  // keyed below while using a union view only for this dynamic merge loop.
  const overviewByRuntimeKey = overview as Partial<
    Record<
      AnalyticsOverviewKey,
      AnalyticsReportOverviewState<AnalyticsOverviewKey>
    >
  >;
  for (const key of expectedOverviewKeys) {
    overviewByRuntimeKey[key] = overviewState(
      report.overview?.[key] ?? OMITTED_OVERVIEW_RESULT,
      state.overview[key],
      stale,
    );
  }
  return {
    ...state,
    mode: report.mode,
    period: report.period,
    sections,
    overview,
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

function settleOverviewFailure(
  state: AnalyticsReportResourceState,
): AnalyticsReportResourceState['overview'] {
  return Object.fromEntries(
    Object.entries(state.overview).map(([key, overview]) => [
      key,
      overview?.data === null || overview?.data === undefined
        ? {
            data: null,
            fetchedAt: null,
            status: 'unavailable' as const,
            error: SECTION_ERROR_MESSAGE,
            retryable: true,
          }
        : {
            ...overview,
            status: 'stale' as const,
            error: REPORT_REFRESH_FAILED_MESSAGE,
            retryable: true,
          },
    ]),
  ) as AnalyticsReportResourceState['overview'];
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
        overview: pendingOverview(state.overview),
        requestId: action.requestId,
        status: hasCommittedData(state) ? 'refreshing' : 'loading',
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
        overview: pendingOverview(state.overview),
        requestId: action.requestId,
        status: hasCommittedData(state) ? 'refreshing' : 'loading',
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
        status: hasCommittedData(state) ? 'refreshing' : 'loading',
        staleSource: null,
        error: null,
        retry: {
          kind: 'canonical_insights_request',
          target: 'section',
          section: action.section,
        },
        requestKind: 'section_retry',
        requestPhase: 'pending',
      };
    case 'overviewRetry':
      return {
        ...state,
        overview: {
          ...state.overview,
          [action.overview]: pendingOverviewGroup(
            state.overview[action.overview],
          ),
        },
        requestId: action.requestId,
        status: hasCommittedData(state) ? 'refreshing' : 'loading',
        staleSource: null,
        error: null,
        retry: {
          kind: 'canonical_insights_request',
          target: 'overview',
          overview: action.overview,
        },
        requestKind: 'overview_retry',
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
        (!hasCommittedData(state) || state.staleSource === 'offline_cache');
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
      if (
        state.requestPhase === 'network_committed' ||
        state.requestPhase === 'network_failed'
      ) {
        return state;
      }

      if (
        state.requestKind === 'section_retry' &&
        state.retry?.target === 'section'
      ) {
        const target = state.retry.section;
        const sections = {
          ...state.sections,
          [target]: sectionState(
            OMITTED_SECTION_RESULT,
            state.sections[target],
            false,
          ),
        };
        return hasCommittedData(state)
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
        state.requestKind === 'overview_retry' &&
        state.retry?.target === 'overview'
      ) {
        const target = state.retry.overview;
        if (target === undefined) return state;
        const overview = {
          ...state.overview,
          [target]: overviewState(
            OMITTED_OVERVIEW_RESULT,
            state.overview[target],
            false,
          ),
        };
        return hasCommittedData(state)
          ? {
              ...state,
              overview,
              status: 'ready',
              staleSource: null,
              error: null,
              retry: null,
              requestPhase: 'network_failed',
            }
          : {
              ...state,
              overview,
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
      const overview = settleOverviewFailure(state);
      return hasCommittedData(state)
        ? {
            ...state,
            sections,
            overview,
            status: 'stale',
            staleSource: 'refresh_failed',
            error: REPORT_REFRESH_FAILED_MESSAGE,
            retry: null,
            requestPhase: 'network_failed',
          }
        : {
            ...state,
            sections,
            overview,
            status: 'error',
            staleSource: null,
            error: REPORT_UNAVAILABLE_MESSAGE,
            retry: null,
            requestPhase: 'network_failed',
          };
    }
  }
}
