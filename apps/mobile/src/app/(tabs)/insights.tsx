import { useCallback, useReducer, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { canonicalInsightsResponseSchema } from '@food-tracker/shared';
import type {
  ReportsResponse,
  Recommendation,
  CanonicalInsightsResponse,
  CanonicalInsightsResponseV2WithOverview,
  AnalyticsPreferenceValue,
  AnalyticsSavedView,
  AnalyticsSectionKey,
  AnalyticsOverviewKey,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ComplexInsightsNutrients } from '@/components/analytics/insights/complex-insights-nutrients';
import { ComplexInsightsOverview } from '@/components/analytics/insights/complex-insights-overview';
import { ComplexInsightsRecommendations } from '@/components/analytics/insights/complex-insights-recommendations';
import {
  InsightsTabs,
  type InsightsTab,
} from '@/components/analytics/insights/insights-tabs';
import { SimpleInsightsOverview } from '@/components/analytics/insights/simple-insights-overview';
import { ReportPeriodSelector } from '@/components/report-period-selector';
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { API_RUNTIME_ENVIRONMENT, api, errorMessage } from '@/lib/api-client';
import {
  analyticsResourceReducer,
  initialAnalyticsResource,
} from '@/lib/analytics/analytics-resource';
import {
  analyticsReportResourceReducer,
  initialAnalyticsReportResource,
} from '@/lib/analytics/analytics-report-resource';
import { adaptCanonicalInsightsResponseV1 } from '@/lib/analytics/analytics-v1-adapter';
import { useAppStore } from '@/store/app-store';
import { useAuthRuntime } from '@/components/auth/auth-bootstrap';
import {
  analyticsCache,
  ANALYTICS_CACHE_KEYS,
} from '@/lib/analytics/analytics-cache-runtime';
import {
  createStagingInsightsDiagnostic,
  formatStagingInsightsDiagnostic,
  type StagingInsightsDiagnostic,
  type StagingInsightsDiagnosticStage,
} from '@/lib/staging-insights-diagnostics';

function legacyReportFromV2(
  report: CanonicalInsightsResponseV2WithOverview,
): CanonicalInsightsResponse {
  return {
    mode: report.mode,
    period: report.period,
    sections: Object.fromEntries(
      Object.entries(report.sections).flatMap(([key, result]) =>
        result?.status === 'available' ? [[key, result.data]] : [],
      ),
    ),
  };
}

function InsightsSkeleton() {
  return (
    <AppScreen contentClassName="gap-7" backgroundColor="#FFFFFF">
      <View className="gap-3">
        <SkeletonPill width={142} height={34} />
        <SkeletonLine width={180} height={24} />
      </View>
      <View className="gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} className="gap-3 border-t border-line py-4">
            <SkeletonLine width={`${48 + index * 6}%`} height={14} />
            <SkeletonRail height={7} />
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

function ReportEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View className="gap-1 border-t border-line py-5">
      <AppText variant="heading" className="text-ink">
        {title}
      </AppText>
      <AppText muted>{message}</AppText>
    </View>
  );
}

export default function InsightsScreen() {
  const dataVersion = useAppStore((state) => state.dataVersion);
  const { userId } = useAuthRuntime();
  const router = useRouter();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [reportResource, dispatchReport] = useReducer(
    analyticsResourceReducer<CanonicalInsightsResponse>,
    undefined,
    initialAnalyticsResource<CanonicalInsightsResponse>,
  );
  const [sectionReportResource, dispatchSectionReport] = useReducer(
    analyticsReportResourceReducer,
    undefined,
    initialAnalyticsReportResource,
  );
  const report = reportResource.value;
  const reportRequestId = useRef(0);
  const [insightsDiagnostic, setInsightsDiagnostic] =
    useState<StagingInsightsDiagnostic | null>(null);
  const [insightsFailureDiagnostic, setInsightsFailureDiagnostic] =
    useState<StagingInsightsDiagnostic | null>(null);
  const [analyticsPreferences, setAnalyticsPreferences] =
    useState<AnalyticsPreferenceValue | null>(null);
  const [savedViews, setSavedViews] = useState<AnalyticsSavedView[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissedRecommendations, setDismissedRecommendations] = useState<
    Recommendation[]
  >([]);
  const [recommendationsError, setRecommendationsError] = useState<
    string | null
  >(null);
  const [pinnedViewError, setPinnedViewError] = useState<string | null>(null);
  const [complexTab, setComplexTab] = useState<InsightsTab>('overview');
  const [nutrientReport, setNutrientReport] = useState<ReportsResponse | null>(
    null,
  );
  const [nutrientReportLoading, setNutrientReportLoading] = useState(false);
  const [nutrientReportError, setNutrientReportError] = useState<string | null>(
    null,
  );
  const nutrientReportRequestId = useRef(0);

  const loadNutrientReport = useCallback(
    async (nextPeriod: 'week' | 'month') => {
      const requestId = ++nutrientReportRequestId.current;
      setNutrientReportLoading(true);
      setNutrientReportError(null);
      try {
        const nextReport = await api.analytics.reports({ period: nextPeriod });
        if (requestId === nutrientReportRequestId.current) {
          setNutrientReport(nextReport);
        }
      } catch (loadError) {
        if (requestId === nutrientReportRequestId.current) {
          setNutrientReportError(errorMessage(loadError));
        }
      } finally {
        if (requestId === nutrientReportRequestId.current) {
          setNutrientReportLoading(false);
        }
      }
    },
    [],
  );

  const loadReporting = useCallback(
    async (
      nextPeriod: 'week' | 'month',
      asRefresh = false,
      retrySection: AnalyticsSectionKey | null = null,
      retryOverview: AnalyticsOverviewKey | null = null,
    ) => {
      const requestId = ++reportRequestId.current;
      let failureStage: StagingInsightsDiagnosticStage | undefined;
      let cacheValueExists = false;
      const reportInsightsDiagnostic = (
        stage: StagingInsightsDiagnosticStage,
        details: {
          status?: unknown;
          errorCode?: unknown;
          cacheValueExists?: unknown;
          failureStage?: unknown;
        } = {},
      ): StagingInsightsDiagnostic | null => {
        const diagnostic = createStagingInsightsDiagnostic(
          API_RUNTIME_ENVIRONMENT,
          stage,
          requestId,
          details,
        );
        if (diagnostic === null || requestId !== reportRequestId.current) {
          return null;
        }
        if (stage.endsWith('_failed')) {
          failureStage = stage;
          setInsightsFailureDiagnostic(diagnostic);
        }
        if (stage === 'report_failure_dispatched') {
          setInsightsFailureDiagnostic(diagnostic);
        }
        if (
          stage !== 'cache_write_started' &&
          stage !== 'cache_write_succeeded'
        ) {
          setInsightsDiagnostic(diagnostic);
        }
        return diagnostic;
      };
      const errorDetails = (error: unknown) => ({
        status:
          typeof error === 'object' && error !== null
            ? (error as { status?: unknown }).status
            : undefined,
        errorCode:
          typeof error === 'object' && error !== null
            ? (error as { code?: unknown }).code
            : undefined,
      });

      reportInsightsDiagnostic('request_started');
      setInsightsFailureDiagnostic(null);
      dispatchReport({
        type:
          asRefresh || retrySection !== null || retryOverview !== null
            ? 'refresh'
            : 'load',
        requestId,
      });
      dispatchSectionReport(
        retryOverview !== null
          ? { type: 'overviewRetry', requestId, overview: retryOverview }
          : retrySection === null
            ? { type: asRefresh ? 'refresh' : 'load', requestId }
            : { type: 'sectionRetry', requestId, section: retrySection },
      );
      const cacheKey =
        nextPeriod === 'week'
          ? ANALYTICS_CACHE_KEYS.insightsWeek
          : ANALYTICS_CACHE_KEYS.insightsMonth;
      if (
        !asRefresh &&
        retrySection === null &&
        retryOverview === null &&
        userId !== null
      ) {
        reportInsightsDiagnostic('cache_read_started');
        try {
          const cached = await analyticsCache().read(
            userId,
            cacheKey,
            (value): value is CanonicalInsightsResponse =>
              canonicalInsightsResponseSchema.safeParse(value).success,
          );
          if (cached !== null)
            dispatchReport({
              type: 'hydrate',
              requestId,
              value: cached.value,
              updatedAt: cached.updatedAt,
              stale: cached.stale,
            });
          if (cached !== null) {
            const adapted = adaptCanonicalInsightsResponseV1(
              cached.value,
              new Date(cached.updatedAt).toISOString(),
            );
            if (adapted !== null) {
              dispatchSectionReport({
                type: 'hydrate',
                requestId,
                report: adapted,
                updatedAt: cached.updatedAt,
                stale: cached.stale,
              });
            }
          }
          cacheValueExists = cached !== null;
          reportInsightsDiagnostic('cache_read_succeeded', {
            cacheValueExists,
          });
          if (cached !== null) {
            dispatchReport({ type: 'refresh', requestId });
            dispatchSectionReport({ type: 'refresh', requestId });
          }
        } catch (cacheError) {
          reportInsightsDiagnostic('cache_read_failed', {
            ...errorDetails(cacheError),
            cacheValueExists,
          });
          // Cache failures never block canonical reporting.
        }
      }
      try {
        const insights = await api.analytics.insights(nextPeriod, (event) => {
          reportInsightsDiagnostic(event.stage, { status: event.status });
        });
        const legacyInsights = legacyReportFromV2(insights);
        reportInsightsDiagnostic('api_insights_resolved');
        dispatchReport({
          type: 'commit',
          requestId,
          value: legacyInsights,
          updatedAt: Date.now(),
        });
        dispatchSectionReport({
          type: 'commit',
          requestId,
          report: insights,
          updatedAt: Date.now(),
        });
        reportInsightsDiagnostic('report_commit_dispatched');
        if (userId !== null) {
          reportInsightsDiagnostic('cache_write_started');
          void analyticsCache()
            .write(userId, cacheKey, legacyInsights)
            .then(() => {
              reportInsightsDiagnostic('cache_write_succeeded');
            })
            .catch((cacheError: unknown) => {
              reportInsightsDiagnostic('cache_write_failed', {
                ...errorDetails(cacheError),
              });
            });
        }
        if (insights.mode === 'complex') {
          void loadNutrientReport(nextPeriod);
          try {
            const [preferences, views] = await Promise.all([
              api.analytics.preferences(),
              api.analytics.savedViews(),
            ]);
            setAnalyticsPreferences(preferences);
            setSavedViews(views);
            setPinnedViewError(null);
          } catch (pinnedError) {
            setAnalyticsPreferences(null);
            setSavedViews([]);
            setPinnedViewError(errorMessage(pinnedError));
          }
        } else {
          nutrientReportRequestId.current += 1;
          setNutrientReportLoading(false);
          setComplexTab('overview');
          setNutrientReport(null);
          setNutrientReportError(null);
          setAnalyticsPreferences(null);
          setSavedViews([]);
          setPinnedViewError(null);
        }
      } catch (loadError) {
        dispatchReport({
          type: 'failure',
          requestId,
          message: errorMessage(loadError),
        });
        dispatchSectionReport({ type: 'failure', requestId });
        reportInsightsDiagnostic('report_failure_dispatched', {
          ...errorDetails(loadError),
          cacheValueExists,
          failureStage,
        });
      }
    },
    [loadNutrientReport, userId],
  );

  const loadRecommendations = useCallback(async () => {
    setRecommendationsError(null);
    try {
      await api.recommendations.generate().catch(() => undefined);
      const [activeResult, dismissedResult] = await Promise.allSettled([
        api.recommendations.list('active'),
        api.recommendations.list('dismissed'),
      ]);
      if (activeResult.status === 'rejected') {
        throw activeResult.reason;
      }
      setRecommendations(activeResult.value);
      if (dismissedResult.status === 'fulfilled') {
        setDismissedRecommendations(dismissedResult.value);
      }
    } catch (loadError) {
      setRecommendationsError(errorMessage(loadError));
    }
  }, []);

  const loadInsights = useCallback(
    async (asRefresh = false) => {
      await Promise.allSettled([
        loadReporting(period, asRefresh),
        loadRecommendations(),
      ]);
    },
    [loadRecommendations, loadReporting, period],
  );

  const changePeriod = (nextPeriod: 'week' | 'month') => {
    if (nextPeriod === period) return;
    setPeriod(nextPeriod);
  };

  const retrySimpleOverview = useCallback(
    (overview: AnalyticsOverviewKey) => {
      void loadReporting(period, false, null, overview);
    },
    [loadReporting, period],
  );

  const isSimpleOverview = sectionReportResource.mode === 'simple';

  const dismissRecommendation = useCallback(async (id: string) => {
    setRecommendationsError(null);
    try {
      const dismissed = await api.recommendations.dismiss(id);
      setRecommendations((current) =>
        current.filter((recommendation) => recommendation.id !== id),
      );
      setDismissedRecommendations((current) => [dismissed, ...current]);
    } catch (dismissError) {
      setRecommendationsError(errorMessage(dismissError));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInsights();
    }, [dataVersion, loadInsights]),
  );

  if (
    reportResource.status === 'loading' &&
    report === null &&
    recommendations.length === 0
  ) {
    return <InsightsSkeleton />;
  }

  return (
    <AppScreen
      refreshing={reportResource.status === 'refreshing'}
      contentClassName="gap-7"
      backgroundColor="#FFFFFF"
      onRefresh={() => void loadInsights(true)}
    >
      <View className="gap-3">
        <AppText
          variant="title"
          className="text-[38px] leading-[46px] text-ink"
        >
          Insights
        </AppText>
        <ReportPeriodSelector
          period={period}
          onChange={changePeriod}
          disabled={
            reportResource.status === 'loading' ||
            reportResource.status === 'refreshing'
          }
        />
        {report === null ? null : (
          <AppText variant="caption" className="text-muted">
            Last {period === 'week' ? 7 : 30} days
          </AppText>
        )}
      </View>

      {reportResource.error === null || isSimpleOverview ? null : (
        <View className="gap-2">
          <ErrorState
            title={
              report === null
                ? 'Reports are unavailable'
                : 'Couldn’t refresh reports'
            }
            message={reportResource.error}
            onRetry={() => void loadReporting(period, true)}
          />
          {insightsDiagnostic === null ||
          insightsFailureDiagnostic === null ? null : (
            <AppText variant="caption" className="text-muted">
              {formatStagingInsightsDiagnostic({
                ...insightsFailureDiagnostic,
                stage: 'report_failure_dispatched',
                failureStage: insightsFailureDiagnostic.stage,
              })}
            </AppText>
          )}
        </View>
      )}
      {reportResource.error === null && insightsDiagnostic !== null ? (
        <AppText variant="caption" className="text-muted">
          {formatStagingInsightsDiagnostic(insightsDiagnostic)}
        </AppText>
      ) : null}
      {isSimpleOverview ? (
        <SimpleInsightsOverview
          resource={sectionReportResource}
          onExploreTrends={() => router.push('/trends' as never)}
          onLogWater={() => router.push('/water-log' as never)}
          onOverviewRetry={retrySimpleOverview}
        />
      ) : report === null ? (
        reportResource.error === null ? (
          <ReportEmptyState
            title="No report yet"
            message="Log a meal to begin a useful period summary."
          />
        ) : null
      ) : (
        <>
          <InsightsTabs value={complexTab} onChange={setComplexTab} />
          {pinnedViewError === null ? null : (
            <AppText variant="caption" className="text-muted">
              Your primary view is unavailable right now. Insights remain up to
              date.
            </AppText>
          )}
          {complexTab === 'overview' ? (
            <ComplexInsightsOverview
              resource={sectionReportResource}
              preferences={
                analyticsPreferences ?? {
                  preferredSimpleMetric: 'calories',
                  pinnedSavedViewId: null,
                }
              }
              views={savedViews}
              onExploreTrends={() => router.push('/trends' as never)}
              onLogWater={() => router.push('/water-log' as never)}
              onOverviewRetry={(overview) =>
                void loadReporting(period, false, null, overview)
              }
              onManagePinned={() => router.push('/trends/saved-views' as never)}
              onOpenPinned={(metric, query) =>
                router.push({
                  pathname: '/trends/[metric]',
                  params: { metric, query },
                } as never)
              }
            />
          ) : complexTab === 'nutrients' ? (
            <ComplexInsightsNutrients
              report={nutrientReport}
              loading={nutrientReportLoading}
              error={nutrientReportError}
              onRetry={() => void loadNutrientReport(period)}
              onOverviewRetry={() =>
                void loadReporting(period, false, null, 'nutrientHighlights')
              }
              overview={sectionReportResource.overview.nutrientHighlights}
              onExploreTrends={() => router.push('/trends/nutrients' as never)}
            />
          ) : (
            <ComplexInsightsRecommendations
              recommendations={recommendations}
              dismissedRecommendations={dismissedRecommendations}
              error={recommendationsError}
              onDismiss={(id) => void dismissRecommendation(id)}
            />
          )}
        </>
      )}

      {isSimpleOverview ? (
        <ComplexInsightsRecommendations
          recommendations={recommendations}
          dismissedRecommendations={dismissedRecommendations}
          error={recommendationsError}
          onDismiss={(id) => void dismissRecommendation(id)}
        />
      ) : null}

      <View className="flex-row items-start gap-3 border-t border-line py-5">
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="label" className="text-ink">
            Simple tracking, serious insight
          </AppText>
          <AppText muted>
            Your patterns become clearer as you build a consistent log.
          </AppText>
        </View>
      </View>
    </AppScreen>
  );
}
