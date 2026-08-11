import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { RefreshCw, X } from 'lucide-react-native';
import {
  analyticsMetricForKey,
  canonicalInsightsResponseSchema,
} from '@food-tracker/shared';
import type {
  Recommendation,
  RecommendationSeverity,
  RecommendationType,
  CanonicalInsightsResponse,
  CanonicalTrendResponse,
  AnalyticsPreferenceValue,
  AnalyticsSavedView,
  AnalyticsSectionKey,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { SimpleInsightsOverview } from '@/components/analytics/insights/simple-insights-overview';
import { ReportPeriodSelector } from '@/components/report-period-selector';
import {
  ReportingIcon,
  type ReportingIconName,
} from '@/components/reporting-icon';
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
import {
  pinnedInsightsTrendQuery,
  trendQueryFromSavedView,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';
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
import { colors } from '@/theme/tokens';

function IconDot({ name }: { name: ReportingIconName }) {
  return <ReportingIcon name={name} size={32} />;
}

function severityLabel(severity: RecommendationSeverity): string {
  if (severity === 'high') return 'High priority';
  if (severity === 'medium') return 'Medium priority';
  return 'Low priority';
}

function recommendationMeta(
  type: RecommendationType,
  severity: RecommendationSeverity,
) {
  const severityColor =
    severity === 'high'
      ? colors.light.ink
      : severity === 'medium'
        ? colors.light.fat
        : colors.light.muted;
  switch (type) {
    case 'protein_low':
      return {
        icon: 'macros' as const,
        color: colors.light.sageDark,
        label: 'Protein',
      };
    case 'calories_under_target':
    case 'calories_over_target':
      return {
        icon: 'energy' as const,
        color: colors.light.carbs,
        label: 'Calories',
      };
    case 'missing_recent_weight_logs':
      return {
        icon: 'weight' as const,
        color: colors.light.fat,
        label: 'Weight',
      };
    case 'inconsistent_food_logging':
      return {
        icon: 'momentum' as const,
        color: severityColor,
        label: 'Consistency',
      };
  }
}

function RecommendationRow({
  recommendation,
  dismissing,
  disabled,
  onDismiss,
}: {
  recommendation: Recommendation;
  dismissing: boolean;
  disabled: boolean;
  onDismiss: () => void;
}) {
  const meta = recommendationMeta(recommendation.type, recommendation.severity);
  return (
    <View className="flex-row items-start gap-3 border-t border-line py-4">
      <IconDot name={meta.icon} />
      <View className="min-w-0 flex-1 gap-2">
        <AppText variant="caption" className="text-muted">
          {severityLabel(recommendation.severity)} · {meta.label}
        </AppText>
        <AppText variant="label" className="text-ink">
          {recommendation.title}
        </AppText>
        <AppText muted>{recommendation.message}</AppText>
        <Pressable
          accessibilityLabel={`Dismiss recommendation: ${recommendation.title}`}
          accessibilityRole="button"
          className={`min-h-10 self-start flex-row items-center gap-2 py-1 pr-3 active:opacity-70 ${disabled ? 'opacity-45' : ''}`}
          disabled={disabled}
          onPress={onDismiss}
        >
          {dismissing ? (
            <ActivityIndicator color={colors.light.primaryDark} />
          ) : (
            <X color={colors.light.muted} size={15} strokeWidth={2.35} />
          )}
          <AppText variant="caption" className="text-muted">
            Dismiss
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function RecommendationsContent({
  recommendations,
  dismissingId,
  onDismiss,
}: {
  recommendations: Recommendation[];
  dismissingId: string | null;
  onDismiss: (id: string) => void;
}) {
  if (recommendations.length === 0) {
    return (
      <View className="flex-row items-start gap-3 border-t border-line py-5">
        <IconDot name="tips" />
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="label" className="text-ink">
            No recommendations right now
          </AppText>
          <AppText muted>
            Keep logging and fresh suggestions will appear when there’s
            something useful to act on.
          </AppText>
        </View>
      </View>
    );
  }
  return (
    <View>
      {recommendations.map((recommendation) => (
        <RecommendationRow
          key={recommendation.id}
          recommendation={recommendation}
          dismissing={dismissingId === recommendation.id}
          disabled={dismissingId !== null && dismissingId !== recommendation.id}
          onDismiss={() => onDismiss(recommendation.id)}
        />
      ))}
    </View>
  );
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

function CanonicalInsightsContent({
  insights,
}: {
  insights: CanonicalInsightsResponse;
}) {
  const router = useRouter();
  return (
    <View className="gap-2">
      {Object.values(insights.sections).map((section) => {
        if (section === undefined) return null;
        const definition = analyticsMetricForKey(section.primaryMetric);
        return (
          <Pressable
            key={section.primaryMetric}
            accessibilityRole="button"
            accessibilityLabel={`View ${definition.displayName} trend`}
            className="min-h-11 border-t border-line py-4 active:opacity-70"
            onPress={() =>
              router.push(`/trends/${section.primaryMetric}` as never)
            }
          >
            <View className="flex-row items-center justify-between gap-3">
              <AppText variant="label">{definition.displayName}</AppText>
              <AppText variant="heading" className="tabular-nums">
                {section.summary.average === null
                  ? '—'
                  : section.summary.average.toFixed(1)}
              </AppText>
            </View>
            <AppText variant="caption" muted>
              {section.summary.numericDayCount} recorded {definition.unit} days
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function PinnedInsightsView({
  preferences,
  views,
}: {
  preferences: AnalyticsPreferenceValue;
  views: readonly AnalyticsSavedView[];
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pinned = useMemo(
    () => views.find((view) => view.id === preferences.pinnedSavedViewId),
    [preferences.pinnedSavedViewId, views],
  );
  const pinnedQuery = useMemo(
    () => (pinned === undefined ? null : trendQueryFromSavedView(pinned)),
    [pinned],
  );
  const query = useMemo(
    () =>
      pinnedQuery ??
      pinnedInsightsTrendQuery(preferences.pinnedSavedViewId, views),
    [pinnedQuery, preferences.pinnedSavedViewId, views],
  );
  const queryKey = trendQueryRouteParam(query);
  const [preview, setPreview] = useState<CanonicalTrendResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setPreview(null);
    setPreviewError(null);
    void api.analytics
      .trend(query)
      .then((response) => {
        if (current) setPreview(response);
      })
      .catch((cause: unknown) => {
        if (current) setPreviewError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [query, queryKey]);
  const label =
    pinnedQuery === null || pinned === undefined ? 'Calories' : pinned.name;
  const previewPoints =
    preview?.points.map((point) => ({
      date: point.kind === 'daily' ? point.date : point.bucketStartDate,
      value: point.value,
    })) ?? [];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open pinned view: ${label}`}
      className="min-h-11 gap-1 border-t border-line py-4 active:opacity-70"
      onPress={() =>
        router.push({
          pathname: '/trends/[metric]',
          params: {
            metric: query.primaryMetric,
            query: trendQueryRouteParam(query),
          },
        } as never)
      }
    >
      <AppText variant="caption" className="text-muted">
        Primary view
      </AppText>
      <AppText variant="label">{label}</AppText>
      <AppText variant="caption" muted>
        {query.period.kind === 'relative'
          ? `${query.period.days}D rolling`
          : 'Open Trend'}
      </AppText>
      {previewError === null ? null : (
        <AppText variant="caption" muted>
          Primary view preview is unavailable. Open Trend to retry.
        </AppText>
      )}
      {preview === null || previewError !== null ? (
        previewError === null ? (
          <AppText variant="caption" muted>
            Loading primary view…
          </AppText>
        ) : null
      ) : (
        <LineTrendChart
          data={previewPoints}
          width={Math.max(280, width - 40)}
          color="#C9242D"
          accessibilityLabel={`${label} primary view preview`}
        />
      )}
    </Pressable>
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
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<
    string | null
  >(null);
  const [pinnedViewError, setPinnedViewError] = useState<string | null>(null);

  const loadReporting = useCallback(
    async (
      nextPeriod: 'week' | 'month',
      asRefresh = false,
      retrySection: AnalyticsSectionKey | null = null,
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
        type: asRefresh || retrySection !== null ? 'refresh' : 'load',
        requestId,
      });
      dispatchSectionReport(
        retrySection === null
          ? { type: asRefresh ? 'refresh' : 'load', requestId }
          : { type: 'sectionRetry', requestId, section: retrySection },
      );
      const cacheKey =
        nextPeriod === 'week'
          ? ANALYTICS_CACHE_KEYS.insightsWeek
          : ANALYTICS_CACHE_KEYS.insightsMonth;
      if (!asRefresh && retrySection === null && userId !== null) {
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
        reportInsightsDiagnostic('api_insights_resolved');
        dispatchReport({
          type: 'commit',
          requestId,
          value: insights,
          updatedAt: Date.now(),
        });
        const adapted = adaptCanonicalInsightsResponseV1(
          insights,
          new Date().toISOString(),
        );
        if (adapted !== null) {
          dispatchSectionReport({
            type: 'commit',
            requestId,
            report: adapted,
            updatedAt: Date.now(),
          });
        }
        reportInsightsDiagnostic('report_commit_dispatched');
        if (userId !== null) {
          reportInsightsDiagnostic('cache_write_started');
          void analyticsCache()
            .write(userId, cacheKey, insights)
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
    [userId],
  );

  const loadRecommendations = useCallback(async () => {
    setRecommendationsError(null);
    try {
      await api.recommendations.generate();
      setRecommendations(await api.recommendations.list());
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

  const retrySimpleSection = useCallback(
    (section: AnalyticsSectionKey) => {
      void loadReporting(period, false, section);
    },
    [loadReporting, period],
  );

  const isSimpleOverview = sectionReportResource.mode === 'simple';

  const dismissRecommendation = useCallback(async (id: string) => {
    setDismissingId(id);
    setRecommendationsError(null);
    try {
      await api.recommendations.dismiss(id);
      setRecommendations((current) =>
        current.filter((recommendation) => recommendation.id !== id),
      );
    } catch (dismissError) {
      setRecommendationsError(errorMessage(dismissError));
    } finally {
      setDismissingId(null);
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
          onSectionRetry={retrySimpleSection}
        />
      ) : report === null ? (
        reportResource.error === null ? (
          <ReportEmptyState
            title="No report yet"
            message="Log a meal to begin a useful period summary."
          />
        ) : null
      ) : Object.values(report.sections).every(
          (section) => section?.summary.numericDayCount === 0,
        ) ? (
        <ReportEmptyState
          title="Start with your first log"
          message="Log a meal to make energy, macro, consistency, and comparison reports visible here."
        />
      ) : (
        <>
          {report.mode === 'complex' && analyticsPreferences !== null ? (
            <PinnedInsightsView
              preferences={analyticsPreferences}
              views={savedViews}
            />
          ) : null}
          {pinnedViewError === null ? null : (
            <AppText variant="caption" muted>
              Your primary view is unavailable right now. Insights remain up to
              date.
            </AppText>
          )}
          <CanonicalInsightsContent insights={report} />
        </>
      )}

      <View className="gap-3 border-t border-line pt-6">
        <View className="flex-row items-end justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="heading" className="text-ink">
              Recommendations
            </AppText>
            <AppText className="text-muted">
              Useful next steps based on what you’ve logged.
            </AppText>
          </View>
          <AppButton
            variant="ghost"
            className="min-h-10 px-1 py-1"
            loading={reportResource.status === 'refreshing' && report !== null}
            disabled={reportResource.status === 'loading'}
            onPress={() => void loadRecommendations()}
          >
            <View className="flex-row items-center gap-1.5">
              <RefreshCw
                color={colors.light.primaryDark}
                size={14}
                strokeWidth={2.35}
              />
              <AppText variant="caption" className="text-primary-dark">
                Refresh
              </AppText>
            </View>
          </AppButton>
        </View>
        {recommendationsError === null ? null : (
          <ErrorState
            title={
              recommendations.length === 0
                ? 'Recommendations are unavailable'
                : 'Couldn’t refresh recommendations'
            }
            message={recommendationsError}
            onRetry={() => void loadRecommendations()}
          />
        )}
        {recommendationsError === null || recommendations.length > 0 ? (
          <RecommendationsContent
            recommendations={recommendations}
            dismissingId={dismissingId}
            onDismiss={(id) => void dismissRecommendation(id)}
          />
        ) : null}
      </View>

      <View className="flex-row items-start gap-3 border-t border-line py-5">
        <IconDot name="tips" />
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
