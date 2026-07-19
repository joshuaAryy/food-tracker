import type { ComponentType } from 'react';
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
  TrendingUp,
  Wheat,
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
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { api, errorMessage } from '@/lib/api-client';
import {
  availableValue,
  calorieAdherenceStatus,
  comparisonSentences,
  nutrientKeysForMode,
  proteinAdherenceStatus,
  streakHeadline,
} from '@/lib/reporting-ui';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

type InsightIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

const accent = {
  calories: '#D98275',
  protein: '#679C8C',
  carbs: '#C99A58',
  fat: '#6F88B4',
  alert: '#A87962',
  calm: colors.light.ink,
} as const;

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString('en-US', { maximumFractionDigits });
}

function formatDifference(value: number, unit: string): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)} ${unit}`;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(start);
  const endText = new Intl.DateTimeFormat('en-US', {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
  }).format(end);
  return `${startText} – ${endText}`;
}

function formatWeight(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} lb`;
}

function modeNutrientKeys(
  report: Pick<ReportsResponse['current'], 'nutrients'>,
  mode: ReportsResponse['trackingMode'],
): string[] {
  const simpleKeys = [
    'calories',
    'protein',
    'carbs',
    'fat',
    ...nutrientKeysForMode(mode),
  ];
  if (mode === 'simple') {
    return simpleKeys.filter((key) => report.nutrients[key] !== undefined);
  }
  return Object.keys(report.nutrients);
}

function nutrientLabel(key: string): string {
  const labels: Record<string, string> = {
    calories: 'Calories',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    fiber: 'Fiber',
    sugar: 'Sugar',
    sodium: 'Sodium',
  };
  return (
    labels[key] ??
    key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())
  );
}

function nutrientUnit(key: string): string {
  return key === 'calories' ? 'kcal' : key === 'sodium' ? 'mg' : 'g';
}

function IconDot({
  Icon,
  color = colors.light.ink,
}: {
  Icon: InsightIcon;
  color?: string;
}) {
  return (
    <View className="h-8 w-8 items-center justify-center">
      <Icon color={color} size={16} strokeWidth={2.2} />
    </View>
  );
}

function SectionHeader({
  title,
  detail,
}: {
  title: string;
  detail?: string | undefined;
}) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <AppText variant="heading" className="text-ink">
        {title}
      </AppText>
      {detail === undefined ? null : (
        <AppText variant="caption" className="text-muted">
          {detail}
        </AppText>
      )}
    </View>
  );
}

function ReportRow({
  Icon,
  color,
  label,
  value,
  detail,
}: {
  Icon: InsightIcon;
  color: string;
  label: string;
  value: string;
  detail?: string | undefined;
}) {
  return (
    <View className="flex-row items-center gap-3 border-t border-line py-4">
      <IconDot Icon={Icon} color={color} />
      <View className="min-w-0 flex-1 gap-0.5">
        <AppText variant="label" className="text-ink">
          {label}
        </AppText>
        {detail === undefined ? null : (
          <AppText variant="caption" className="text-muted">
            {detail}
          </AppText>
        )}
      </View>
      <AppText variant="label" className="text-ink tabular-nums">
        {value}
      </AppText>
    </View>
  );
}

function PeriodToggle({
  period,
  onChange,
  disabled,
}: {
  period: 'week' | 'month';
  onChange: (period: 'week' | 'month') => void;
  disabled: boolean;
}) {
  return (
    <View className="flex-row self-start border-b border-line">
      {(['week', 'month'] as const).map((option) => {
        const active = option === period;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option === 'week' ? 'Week' : 'Month'} reports`}
            className={`min-h-10 justify-center border-b-2 px-4 ${active ? 'border-primary' : 'border-transparent'} ${disabled ? 'opacity-50' : ''}`}
            disabled={disabled}
            onPress={() => onChange(option)}
          >
            <AppText
              variant="label"
              className={active ? 'text-ink' : 'text-muted'}
            >
              {option === 'week' ? 'Week' : 'Month'}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function DayStrip({
  days,
}: {
  days: ReportsResponse['current']['dailyBreakdown'];
}) {
  return (
    <View className="gap-2 border-t border-line pt-4">
      <AppText variant="caption" className="text-muted">
        Logged days
      </AppText>
      <View className="flex-row gap-1.5">
        {days.map((day) => (
          <View key={day.date} className="min-w-0 flex-1 items-center gap-1">
            <View
              className={`h-2.5 w-full rounded-sm ${day.logged ? 'bg-primary' : 'bg-[#E9E7E2]'}`}
            />
            <AppText variant="caption" className="text-muted">
              {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'narrow',
              })}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function AdherenceRows({
  report,
  goalDirection,
}: {
  report: ReportsResponse['current'];
  goalDirection: ReportsResponse['goalDirection'];
}) {
  const calorie = availableValue(report.calorieAdherence);
  const protein = availableValue(report.proteinAdherence);
  if (calorie === null && protein === null) return null;
  return (
    <View className="gap-1">
      <SectionHeader title="Nutrition adherence" detail="Recorded FoodLogs" />
      {calorie === null ? null : (
        <ReportRow
          Icon={Flame}
          color={accent.calories}
          label="Calories"
          value={`${formatNumber(calorie.percentage, 0)}%`}
          detail={
            calorieAdherenceStatus(report.calorieAdherence, goalDirection) ??
            undefined
          }
        />
      )}
      {protein === null ? null : (
        <ReportRow
          Icon={Beef}
          color={accent.protein}
          label="Protein"
          value={`${formatNumber(protein.percentage, 0)}%`}
          detail={proteinAdherenceStatus(report.proteinAdherence) ?? undefined}
        />
      )}
    </View>
  );
}

function WeightSection({ report }: { report: ReportsResponse['current'] }) {
  const weight = availableValue(report.weight);
  if (weight === null) return null;
  return (
    <View className="gap-1">
      <SectionHeader title="Weight" />
      <ReportRow
        Icon={Scale}
        color={accent.fat}
        label="Latest"
        value={formatWeight(weight.latestWeightLb)}
      />
      {weight.changeLb === null ? null : (
        <ReportRow
          Icon={TrendingUp}
          color={accent.fat}
          label="Period change"
          value={formatDifference(weight.changeLb, 'lb')}
          detail={
            weight.direction === null
              ? undefined
              : `${weight.direction[0]?.toUpperCase()}${weight.direction.slice(1)}`
          }
        />
      )}
      {weight.trendRateLbPerWeek === null ? null : (
        <ReportRow
          Icon={TrendingUp}
          color={accent.fat}
          label="Trend"
          value={`${formatDifference(weight.trendRateLbPerWeek, 'lb')} / week`}
        />
      )}
      {weight.progressToTargetPercent === null ? null : (
        <ReportRow
          Icon={Scale}
          color={accent.fat}
          label="Target progress"
          value={`${formatNumber(weight.progressToTargetPercent, 0)}%`}
          detail={
            weight.progressFromBaselineLb === null
              ? undefined
              : 'Since tracking began'
          }
        />
      )}
    </View>
  );
}

function NutrientSection({
  report,
  mode,
  title = 'Nutrients',
}: {
  report: Pick<ReportsResponse['current'], 'nutrients'>;
  mode: ReportsResponse['trackingMode'];
  title?: string;
}) {
  const keys = modeNutrientKeys(report, mode);
  if (keys.length === 0) return null;
  return (
    <View className="gap-1">
      <SectionHeader
        title={title}
        detail={mode === 'complex' ? 'Average per logged day' : undefined}
      />
      {keys.map((key) => (
        <ReportRow
          key={key}
          Icon={key === 'protein' ? Beef : key === 'calories' ? Flame : Wheat}
          color={
            key === 'protein'
              ? accent.protein
              : key === 'calories'
                ? accent.calories
                : accent.calm
          }
          label={nutrientLabel(key)}
          value={`${formatNumber(report.nutrients[key] ?? 0)} ${nutrientUnit(key)}`}
        />
      ))}
    </View>
  );
}

function ComparisonSection({ report }: { report: ReportsResponse }) {
  const sentences = comparisonSentences(report.comparison);
  return (
    <View className="gap-3">
      <SectionHeader title="Equivalent comparison" />
      <AppText variant="caption" className="text-muted">
        {formatDateRange(
          report.comparison.currentBoundary.startDate,
          report.comparison.currentBoundary.endDate,
        )}{' '}
        compared with{' '}
        {formatDateRange(
          report.comparison.previousEquivalentBoundary.startDate,
          report.comparison.previousEquivalentBoundary.endDate,
        )}
      </AppText>
      {sentences.length === 0 ? (
        <AppText className="text-muted">
          Comparison will appear when both elapsed windows have enough recorded
          days.
        </AppText>
      ) : (
        sentences.map((sentence) => (
          <AppText
            key={sentence}
            className="border-t border-line py-3 text-muted"
          >
            {sentence}
          </AppText>
        ))
      )}
    </View>
  );
}

function ReportContent({ report }: { report: ReportsResponse }) {
  const currentHasLogs = report.current.loggedDays > 0;
  const previousHasLogs = report.previousCompleted.loggedDays > 0;
  if (!currentHasLogs && !previousHasLogs) {
    return (
      <EmptyState
        title="Start with your first log"
        message="Log a meal to begin your streak and make weekly patterns visible here."
        symbol="◔"
      />
    );
  }

  const periodLabel = report.period === 'week' ? 'week' : 'month';
  const streak = report.current.streak;
  return (
    <View className="gap-8">
      <View className="gap-2">
        <SectionHeader title={`So far this ${periodLabel}`} />
        <AppText variant="caption" className="text-muted">
          {formatDateRange(
            report.current.boundaries.startDate,
            report.current.boundaries.elapsedThroughDate,
          )}{' '}
          · in progress
        </AppText>
        <ReportRow
          Icon={CalendarCheck}
          color={colors.light.ink}
          label={streakHeadline(streak.loggedDays)}
          value={`${streak.loggedDays} logged`}
          detail={
            streak.spanDays > streak.loggedDays
              ? `${streak.loggedDays} days across ${streak.spanDays} days`
              : streak.graceUsed
                ? 'Grace day used'
                : 'Actual logged days'
          }
        />
        <DayStrip days={report.current.dailyBreakdown} />
      </View>

      <ComparisonSection report={report} />

      <AdherenceRows
        report={report.current}
        goalDirection={report.goalDirection}
      />
      <WeightSection report={report.current} />
      <NutrientSection report={report.current} mode={report.trackingMode} />

      <View className="gap-3">
        <SectionHeader
          title={
            report.period === 'week'
              ? 'Last week · full week'
              : 'Last month · full month'
          }
        />
        <AppText variant="caption" className="text-muted">
          {formatDateRange(
            report.previousCompleted.boundaries.startDate,
            report.previousCompleted.boundaries.endDate,
          )}
        </AppText>
        <ReportRow
          Icon={CalendarCheck}
          color={colors.light.muted}
          label="Logged days"
          value={`${report.previousCompleted.loggedDays}`}
          detail={
            report.previousCompleted.consistency.available
              ? `${report.previousCompleted.consistency.value.percentage}% consistency`
              : undefined
          }
        />
        {report.previousCompleted.loggedDays === 0 ? null : (
          <>
            <ReportRow
              Icon={Flame}
              color={accent.calories}
              label="Average calories"
              value={`${formatNumber(report.previousCompleted.averageCalories, 0)} kcal`}
            />
            <ReportRow
              Icon={Beef}
              color={accent.protein}
              label="Average protein"
              value={`${formatNumber(report.previousCompleted.averageProteinGrams, 0)} g`}
            />
          </>
        )}
      </View>

      <NutrientSection
        report={report.previousCompleted}
        mode={report.trackingMode}
        title="Previous nutrients"
      />
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
        ? accent.alert
        : colors.light.muted;
  switch (type) {
    case 'protein_low':
      return { Icon: Beef, color: accent.protein, label: 'Protein' };
    case 'calories_under_target':
    case 'calories_over_target':
      return { Icon: Flame, color: accent.calories, label: 'Calories' };
    case 'missing_recent_weight_logs':
      return { Icon: Scale, color: accent.fat, label: 'Weight' };
    case 'inconsistent_food_logging':
      return {
        Icon: CalendarCheck,
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
      <IconDot Icon={meta.Icon} color={meta.color} />
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
        <IconDot Icon={CheckCircle2} color={accent.protein} />
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
        {Array.from({ length: 5 }, (_, index) => (
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

  if (loading && report === null && recommendations.length === 0)
    return <InsightsSkeleton />;

  return (
    <AppScreen
      refreshing={refreshing}
      contentClassName="gap-7"
      backgroundColor="#FFFFFF"
      onRefresh={() => void loadInsights(true)}
    >
      <View className="gap-3">
        <PeriodToggle
          period={period}
          onChange={changePeriod}
          disabled={reportLoading}
        />
        <AppText variant="caption" className="text-muted">
          Sunday through Saturday · reports use recorded FoodLogs and current
          targets
        </AppText>
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
      {report === null ? null : <ReportContent report={report} />}

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
