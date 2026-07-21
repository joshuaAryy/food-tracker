import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Beef,
  CalendarCheck,
  CheckCircle2,
  Flame,
  Lightbulb,
  RefreshCw,
  Scale,
  X,
} from 'lucide-react-native';
import type {
  Recommendation,
  RecommendationSeverity,
  RecommendationType,
  ReportsResponse,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { InsightsReportContent } from '@/components/insights-report-content';
import { ReportPeriodSelector } from '@/components/report-period-selector';
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

function IconDot({
  Icon,
  color = colors.light.ink,
}: {
  Icon: typeof Flame;
  color?: string;
}) {
  return (
    <View className="h-8 w-8 items-center justify-center">
      <Icon color={color} size={16} strokeWidth={2.2} />
    </View>
  );
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
      return { color: colors.light.sageDark, label: 'Protein' };
    case 'calories_under_target':
    case 'calories_over_target':
      return { color: colors.light.carbs, label: 'Calories' };
    case 'missing_recent_weight_logs':
      return { color: colors.light.fat, label: 'Weight' };
    case 'inconsistent_food_logging':
      return { color: severityColor, label: 'Consistency' };
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
  const Icon =
    recommendation.type === 'protein_low'
      ? Beef
      : recommendation.type === 'missing_recent_weight_logs'
        ? Scale
        : recommendation.type === 'inconsistent_food_logging'
          ? CalendarCheck
          : Flame;
  return (
    <View className="flex-row items-start gap-3 border-t border-line py-4">
      <IconDot Icon={Icon} color={meta.color} />
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
        <IconDot Icon={CheckCircle2} color={colors.light.sageDark} />
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

export default function InsightsScreen() {
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [report, setReport] = useState<ReportsResponse | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<
    string | null
  >(null);

  const loadReporting = useCallback(
    async (nextPeriod: 'week' | 'month', asRefresh = false) => {
      if (asRefresh) setRefreshing(true);
      setReportLoading(true);
      setReportError(null);
      try {
        setReport(await api.analytics.reports({ period: nextPeriod }));
      } catch (loadError) {
        setReportError(errorMessage(loadError));
      } finally {
        setReportLoading(false);
        if (asRefresh) setRefreshing(false);
      }
    },
    [],
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
      if (asRefresh) setRefreshing(true);
      setLoading(true);
      await Promise.allSettled([loadReporting(period), loadRecommendations()]);
      setLoading(false);
      setRefreshing(false);
    },
    [loadRecommendations, loadReporting, period],
  );

  const changePeriod = (nextPeriod: 'week' | 'month') => {
    if (nextPeriod === period) return;
    setPeriod(nextPeriod);
    void loadReporting(nextPeriod);
  };

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

  if (loading && report === null && recommendations.length === 0) {
    return <InsightsSkeleton />;
  }

  return (
    <AppScreen
      refreshing={refreshing}
      contentClassName="gap-7"
      backgroundColor="#FFFFFF"
      onRefresh={() => void loadInsights(true)}
    >
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="title" className="text-ink">
              Insights
            </AppText>
            <AppText variant="caption" className="text-muted">
              Recorded FoodLogs, current goals, and clear period boundaries.
            </AppText>
          </View>
          <ReportPeriodSelector
            period={period}
            onChange={changePeriod}
            disabled={reportLoading}
          />
        </View>
      </View>

      {reportError === null ? null : (
        <ErrorState
          title={
            report === null
              ? 'Reports are unavailable'
              : 'Couldn’t refresh reports'
          }
          message={reportError}
          onRetry={() => void loadReporting(period, true)}
        />
      )}
      {report === null ? (
        reportError === null ? (
          <EmptyState
            title="No report yet"
            message="Log a meal to begin a useful period summary."
            symbol="◔"
          />
        ) : null
      ) : report.current.loggedDays === 0 &&
        report.previousCompleted.loggedDays === 0 ? (
        <EmptyState
          title="Start with your first log"
          message="Log a meal to make energy, macro, consistency, and comparison reports visible here."
          symbol="◔"
        />
      ) : (
        <InsightsReportContent report={report} />
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
            loading={loading && report !== null}
            disabled={loading || refreshing}
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
        <IconDot Icon={Lightbulb} color={colors.light.ink} />
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
