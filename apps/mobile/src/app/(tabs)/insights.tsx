import { useCallback, useReducer, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  ReportsResponse,
  Recommendation,
  AnalyticsSectionKey,
  AnalyticsOverviewKey,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ComplexInsightsNutrients } from '@/components/analytics/insights/complex-insights-nutrients';
import { ComplexInsightsOverview } from '@/components/analytics/insights/complex-insights-overview';
import { ComplexInsightsRecommendations } from '@/components/analytics/insights/complex-insights-recommendations';
import { ExploreTrendsButton } from '@/components/analytics/insights/explore-trends-button';
import {
  InsightsTabs,
  type InsightsTab,
} from '@/components/analytics/insights/insights-tabs';
import { SimpleInsightsOverview } from '@/components/analytics/insights/simple-insights-overview';
import { AnalyticsOfflineBanner } from '@/components/analytics/states/analytics-offline-banner';
import { AnalyticsReportUnavailable } from '@/components/analytics/states/analytics-report-unavailable';
import { AnalyticsSkeleton } from '@/components/analytics/states/analytics-skeleton';
import { ReportPeriodSelector } from '@/components/report-period-selector';
import { api, errorMessage } from '@/lib/api-client';
import {
  analyticsReportResourceReducer,
  initialAnalyticsReportResource,
} from '@/lib/analytics/analytics-report-resource';
import { useAppStore } from '@/store/app-store';
import { useAuthRuntime } from '@/components/auth/auth-bootstrap';
import { analyticsCache } from '@/lib/analytics/analytics-cache-runtime';
import {
  insightsCacheKey,
  isInsightsV2CachePayload,
} from '@/lib/analytics/analytics-report-cache';
import { formatPresentationDateRange } from '@/lib/date-time';

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
  const [sectionReportResource, dispatchSectionReport] = useReducer(
    analyticsReportResourceReducer,
    undefined,
    initialAnalyticsReportResource,
  );
  const reportRequestId = useRef(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissedRecommendations, setDismissedRecommendations] = useState<
    Recommendation[]
  >([]);
  const [recommendationsError, setRecommendationsError] = useState<
    string | null
  >(null);
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

      dispatchSectionReport(
        retryOverview !== null
          ? { type: 'overviewRetry', requestId, overview: retryOverview }
          : retrySection === null
            ? { type: asRefresh ? 'refresh' : 'load', requestId }
            : { type: 'sectionRetry', requestId, section: retrySection },
      );
      const cacheKey = insightsCacheKey(nextPeriod);
      if (
        !asRefresh &&
        retrySection === null &&
        retryOverview === null &&
        userId !== null
      ) {
        try {
          const cached = await analyticsCache().read(
            userId,
            cacheKey,
            isInsightsV2CachePayload,
          );
          if (cached !== null) {
            dispatchSectionReport({
              type: 'hydrate',
              requestId,
              report: cached.value,
              updatedAt: cached.updatedAt,
              stale: cached.stale,
            });
          }
          if (cached !== null) {
            dispatchSectionReport({ type: 'refresh', requestId });
          }
        } catch {
          // Cache failures never block canonical reporting.
        }
      }
      try {
        const insights = await api.analytics.insights(nextPeriod);
        dispatchSectionReport({
          type: 'commit',
          requestId,
          report: insights,
          updatedAt: Date.now(),
        });
        if (userId !== null) {
          void analyticsCache()
            .write(userId, cacheKey, insights)
            .catch(() => undefined);
        }
        if (insights.mode === 'complex') {
          void loadNutrientReport(nextPeriod);
        } else {
          nutrientReportRequestId.current += 1;
          setNutrientReportLoading(false);
          setComplexTab('overview');
          setNutrientReport(null);
          setNutrientReportError(null);
        }
      } catch {
        dispatchSectionReport({ type: 'failure', requestId });
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
  const periodSummary = sectionReportResource.overview.periodSummary;
  const periodMeta =
    periodSummary?.status === 'available' && periodSummary.data !== null
      ? `${formatPresentationDateRange(
          periodSummary.data.resolvedRange.startDate,
          periodSummary.data.resolvedRange.endDate,
        )} · ${periodSummary.data.eligibleLoggedDayCount} logged day${
          periodSummary.data.eligibleLoggedDayCount === 1 ? '' : 's'
        }`
      : null;

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

  const hasCommittedReport =
    Object.values(sectionReportResource.sections).some(
      (section) => section?.data !== null && section?.data !== undefined,
    ) ||
    Object.values(sectionReportResource.overview).some(
      (overview) => overview?.data !== null && overview?.data !== undefined,
    );

  if (
    sectionReportResource.status === 'loading' &&
    !hasCommittedReport &&
    recommendations.length === 0
  ) {
    return <AnalyticsSkeleton period={period} />;
  }

  if (
    !hasCommittedReport &&
    (sectionReportResource.status === 'error' ||
      sectionReportResource.status === 'ready')
  ) {
    return (
      <AnalyticsReportUnavailable
        period={period}
        onRetry={() => void loadReporting(period, true)}
      />
    );
  }

  return (
    <AppScreen
      refreshing={sectionReportResource.status === 'refreshing'}
      contentClassName="gap-4"
      backgroundColor="#FFFFFF"
      onRefresh={() => void loadInsights(true)}
    >
      {sectionReportResource.staleSource === 'offline_cache' ? (
        <AnalyticsOfflineBanner cachedAt={sectionReportResource.updatedAt} />
      ) : null}
      <View className="gap-3">
        <AppText variant="heading" className="text-ink">
          Insights
        </AppText>
        <ReportPeriodSelector
          period={period}
          onChange={changePeriod}
          disabled={
            sectionReportResource.status === 'loading' ||
            sectionReportResource.status === 'refreshing'
          }
        />
        {periodMeta !== null ? (
          <AppText variant="caption" className="text-muted">
            {periodMeta}
          </AppText>
        ) : null}
      </View>

      {sectionReportResource.error === null || isSimpleOverview ? null : (
        <View className="gap-2">
          <ErrorState
            title="Couldn’t refresh reports"
            message={sectionReportResource.error}
            onRetry={() => void loadReporting(period, true)}
          />
        </View>
      )}
      {isSimpleOverview ? (
        <SimpleInsightsOverview
          resource={sectionReportResource}
          onExploreTrends={() => router.push('/trends' as never)}
          onLogWater={() => router.push('/water-log' as never)}
          onOverviewRetry={retrySimpleOverview}
          compact
        />
      ) : !hasCommittedReport ? (
        sectionReportResource.error === null ? (
          <ReportEmptyState
            title="No report yet"
            message="Log a meal to begin a useful period summary."
          />
        ) : null
      ) : (
        <>
          <ExploreTrendsButton
            testID="complex-insights-explore"
            onPress={() => router.push('/trends' as never)}
          />
          <InsightsTabs value={complexTab} onChange={setComplexTab} />
          {complexTab === 'overview' ? (
            <ComplexInsightsOverview
              resource={sectionReportResource}
              onExploreTrends={() => router.push('/trends' as never)}
              onLogWater={() => router.push('/water-log' as never)}
              onOverviewRetry={(overview) =>
                void loadReporting(period, false, null, overview)
              }
              compact
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
              compact
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
          compact
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
