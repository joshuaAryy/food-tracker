import type { ComponentType } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Beef,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Droplet,
  Flame,
  Lightbulb,
  RefreshCw,
  Scale,
  TrendingUp,
  Wheat,
  X,
} from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import type {
  AdvancedAnalytics,
  Recommendation,
  RecommendationSeverity,
  RecommendationType,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import {
  SkeletonBlock,
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { api, errorMessage } from '@/lib/api-client';
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

function formatWeight(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} lb`;
}

function percentage(value: number, maximumFractionDigits = 0): string {
  return `${formatNumber(value, maximumFractionDigits)}%`;
}

function progressFrom(value: number, target: number | null): number {
  if (target === null || target <= 0) return 0;
  return Math.max(0, Math.min(value / target, 1));
}

function IconDot({
  Icon,
  color = colors.light.ink,
  filled = false,
}: {
  Icon: InsightIcon;
  color?: string;
  filled?: boolean;
}) {
  return (
    <View
      className={`h-9 w-9 items-center justify-center rounded-full ${
        filled ? 'bg-primary' : 'bg-[#F4F4F4]'
      }`}
    >
      <Icon color={filled ? '#FFFFFF' : color} size={16} strokeWidth={2.2} />
    </View>
  );
}

function SmallRing({
  progress,
  color,
  size = 58,
  label,
}: {
  progress: number;
  color: string;
  size?: number;
  label?: string;
}) {
  const strokeWidth = 4;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <View
      className="items-center justify-center"
      style={{ height: size, width: size }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        pointerEvents="none"
        className="absolute"
      >
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#ECECEA"
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clampedProgress)}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {label === undefined ? null : (
        <AppText variant="caption" className="text-ink tabular-nums">
          {label}
        </AppText>
      )}
    </View>
  );
}

function MiniRail({
  value,
  color = colors.light.primary,
}: {
  value: number;
  color?: string;
}) {
  const clampedValue = Math.max(0, Math.min(value, 1));

  return (
    <View className="h-2 overflow-hidden rounded-full bg-[#ECECEA]">
      <View
        className="h-full rounded-full"
        style={{ width: `${clampedValue * 100}%`, backgroundColor: color }}
      />
    </View>
  );
}

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
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

function InsightNotice({ title, message }: { title: string; message: string }) {
  return (
    <View className="flex-row items-start gap-3 border-t border-line py-4">
      <IconDot Icon={CircleAlert} color={accent.alert} />
      <View className="min-w-0 flex-1 gap-1">
        <AppText variant="label" className="text-ink">
          {title}
        </AppText>
        <AppText muted>{message}</AppText>
      </View>
    </View>
  );
}

function Overview({ analytics }: { analytics: AdvancedAnalytics }) {
  const calorieAverage = analytics.calorieTrend.average7Day;
  const proteinAverage = analytics.proteinTrend.average7Day;
  const consistency = analytics.loggingConsistency.past7Days;
  const consistencyProgress = consistency.loggedDays / consistency.expectedDays;

  return (
    <View className="gap-5">
      <View className="flex-row items-start justify-between gap-5">
        <View className="min-w-0 flex-1 gap-1.5">
          <AppText
            variant="caption"
            className="text-ink uppercase tracking-[1.4px]"
          >
            Recent patterns
          </AppText>
          <View className="flex-row items-end gap-2">
            <AppText variant="display" className="text-ink tabular-nums">
              {formatNumber(calorieAverage, 0)}
            </AppText>
            <AppText variant="label" className="pb-1.5 text-ink">
              kcal
            </AppText>
          </View>
          <AppText className="text-muted">
            Your 7-day calorie average from recent logs.
          </AppText>
        </View>
        <SmallRing
          progress={progressFrom(calorieAverage, analytics.targets.calories)}
          color={accent.calories}
          size={76}
          label={
            analytics.targets.calories === null
              ? '—'
              : percentage(
                  progressFrom(calorieAverage, analytics.targets.calories) *
                    100,
                )
          }
        />
      </View>

      <View className="gap-4">
        <SignalRow
          Icon={Beef}
          color={accent.protein}
          label="Protein"
          value={`${formatNumber(proteinAverage, 0)} g`}
          detail={
            analytics.targets.proteinGrams === null
              ? 'Recent 7-day average'
              : `${formatNumber(analytics.targets.proteinGrams, 0)} g target`
          }
          progress={progressFrom(
            proteinAverage,
            analytics.targets.proteinGrams,
          )}
        />
        <SignalRow
          Icon={CalendarCheck}
          color={colors.light.ink}
          label="Consistency"
          value={`${consistency.loggedDays} / ${consistency.expectedDays} days`}
          detail="Food logged this week"
          progress={consistencyProgress}
        />
      </View>
    </View>
  );
}

function SignalRow({
  Icon,
  color,
  label,
  value,
  detail,
  progress,
}: {
  Icon: InsightIcon;
  color: string;
  label: string;
  value: string;
  detail: string;
  progress: number;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Icon color={color} size={14} strokeWidth={2.35} />
          <AppText variant="caption" className="text-ink">
            {label}
          </AppText>
        </View>
        <AppText variant="caption" className="text-ink tabular-nums">
          {value}
        </AppText>
      </View>
      <MiniRail value={progress} color={color} />
      <AppText variant="caption" className="text-muted">
        {detail}
      </AppText>
    </View>
  );
}

function TrendPair({
  title,
  unit,
  Icon,
  color,
  sevenDay,
  thirtyDay,
  difference,
  warning,
}: {
  title: string;
  unit: string;
  Icon: InsightIcon;
  color: string;
  sevenDay: number;
  thirtyDay: number;
  difference: number;
  warning: string | null;
}) {
  const maxValue = Math.max(sevenDay, thirtyDay, 1);

  return (
    <View className="gap-4 border-t border-line py-4">
      <View className="flex-row items-start gap-3">
        <IconDot Icon={Icon} color={color} />
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <AppText variant="label" className="text-ink">
              {title}
            </AppText>
            <AppText variant="caption" className="text-muted tabular-nums">
              {formatDifference(difference, unit)}
            </AppText>
          </View>
          <AppText muted>
            Comparing the last 7 days with your 30-day pattern.
          </AppText>
        </View>
      </View>

      <View className="gap-3 pl-12">
        <TrendBar
          label="7 days"
          value={`${formatNumber(sevenDay, 0)} ${unit}`}
          progress={sevenDay / maxValue}
          color={color}
        />
        <TrendBar
          label="30 days"
          value={`${formatNumber(thirtyDay, 0)} ${unit}`}
          progress={thirtyDay / maxValue}
          color={colors.light.ink}
        />
        {warning === null ? null : (
          <AppText variant="caption" className="text-muted">
            Log a few more days to make this pattern clearer.
          </AppText>
        )}
      </View>
    </View>
  );
}

function TrendBar({
  label,
  value,
  progress,
  color,
}: {
  label: string;
  value: string;
  progress: number;
  color: string;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between gap-3">
        <AppText variant="caption" className="text-muted">
          {label}
        </AppText>
        <AppText variant="caption" className="text-ink tabular-nums">
          {value}
        </AppText>
      </View>
      <MiniRail value={progress} color={color} />
    </View>
  );
}

function DetailRow({
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
  detail?: string;
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

function MacroSplit({ analytics }: { analytics: AdvancedAnalytics }) {
  const macroSplitIncomplete =
    !analytics.dataCompleteness.nutrients.carbs.isCompleteEnough ||
    !analytics.dataCompleteness.nutrients.fat.isCompleteEnough;

  return (
    <View className="gap-3">
      <SectionHeader title="Macro split" detail="Detailed mode" />
      <View className="gap-3 border-t border-line py-4">
        <MacroSplitRow
          Icon={Beef}
          color={accent.protein}
          label="Protein"
          value={analytics.macros.calorieSplit.proteinPercent}
        />
        <MacroSplitRow
          Icon={Wheat}
          color={accent.carbs}
          label="Carbs"
          value={analytics.macros.calorieSplit.carbsPercent}
        />
        <MacroSplitRow
          Icon={Droplet}
          color={accent.fat}
          label="Fat"
          value={analytics.macros.calorieSplit.fatPercent}
        />
        {macroSplitIncomplete ? (
          <AppText variant="caption" className="text-muted">
            Some entries are missing macro details, so this split may become
            clearer with more complete logs.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function MacroSplitRow({
  Icon,
  color,
  label,
  value,
}: {
  Icon: InsightIcon;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Icon color={color} size={14} strokeWidth={2.35} />
          <AppText variant="caption" className="text-ink">
            {label}
          </AppText>
        </View>
        <AppText variant="caption" className="text-ink tabular-nums">
          {percentage(value, 1)}
        </AppText>
      </View>
      <MiniRail value={value / 100} color={color} />
    </View>
  );
}

function NutritionDetails({ analytics }: { analytics: AdvancedAnalytics }) {
  const rows = [
    {
      key: 'calories' as const,
      label: 'Calories',
      unit: 'kcal',
      Icon: Flame,
      color: accent.calories,
    },
    {
      key: 'protein' as const,
      label: 'Protein',
      unit: 'g',
      Icon: Beef,
      color: accent.protein,
    },
    {
      key: 'carbs' as const,
      label: 'Carbs',
      unit: 'g',
      Icon: Wheat,
      color: accent.carbs,
    },
    {
      key: 'fat' as const,
      label: 'Fat',
      unit: 'g',
      Icon: Droplet,
      color: accent.fat,
    },
    {
      key: 'fiber' as const,
      label: 'Fiber',
      unit: 'g',
      Icon: Wheat,
      color: colors.light.muted,
    },
    {
      key: 'sugar' as const,
      label: 'Sugar',
      unit: 'g',
      Icon: Wheat,
      color: colors.light.muted,
    },
    {
      key: 'sodium' as const,
      label: 'Sodium',
      unit: 'mg',
      Icon: Droplet,
      color: colors.light.muted,
    },
  ];

  return (
    <View className="gap-3">
      <SectionHeader
        title="Nutrition detail"
        detail={`${analytics.range.startDate} to ${analytics.range.endDate}`}
      />
      <View>
        {rows.map((row) => {
          const completeness = analytics.dataCompleteness.nutrients[row.key];
          const hasReportedValue = completeness.loggedCount > 0;
          const partial = hasReportedValue && !completeness.isCompleteEnough;
          return (
            <DetailRow
              key={row.key}
              Icon={row.Icon}
              color={row.color}
              label={row.label}
              value={
                hasReportedValue
                  ? `${formatNumber(analytics.macros.averagesPerLoggedDay[row.key])} ${row.unit}`
                  : 'Not logged'
              }
              detail={
                hasReportedValue
                  ? `Average per logged day${partial ? ' · still filling in' : ''}`
                  : 'Add this field to see a pattern'
              }
            />
          );
        })}
      </View>
    </View>
  );
}

function AnalyticsContent({ analytics }: { analytics: AdvancedAnalytics }) {
  const hasAnalyticsData =
    analytics.loggingConsistency.past30Days.loggedDays > 0 ||
    analytics.weightTrend.latestWeightLb !== null;

  if (!hasAnalyticsData) {
    return (
      <EmptyState
        title="Your trends will appear here"
        message="Log a few meals or a weight entry to start seeing patterns."
        symbol="◔"
      />
    );
  }

  const isComplex = analytics.trackingMode === 'complex';

  return (
    <View className="gap-7">
      <Overview analytics={analytics} />

      {analytics.dataCompleteness.isLowConfidence ? (
        <InsightNotice
          title="Still building your pattern"
          message={`Food was logged on ${analytics.dataCompleteness.daysWithFoodLogs} of ${analytics.dataCompleteness.totalDaysInRange} recent days. Log a few more days to make these signals clearer.`}
        />
      ) : null}

      <View className="gap-2">
        <SectionHeader title="Trends" detail="7 vs 30 days" />
        <TrendPair
          title="Calories"
          unit="kcal"
          Icon={Flame}
          color={accent.calories}
          sevenDay={analytics.calorieTrend.average7Day}
          thirtyDay={analytics.calorieTrend.average30Day}
          difference={analytics.calorieTrend.difference}
          warning={analytics.calorieTrend.past7Days.warning}
        />
        <TrendPair
          title="Protein"
          unit="g"
          Icon={Beef}
          color={accent.protein}
          sevenDay={analytics.proteinTrend.average7Day}
          thirtyDay={analytics.proteinTrend.average30Day}
          difference={analytics.proteinTrend.difference}
          warning={analytics.proteinTrend.past7Days.warning}
        />
      </View>

      {isComplex ? (
        <>
          <MacroSplit analytics={analytics} />
          <NutritionDetails analytics={analytics} />
        </>
      ) : null}

      <View className="gap-3">
        <SectionHeader title="Consistency" />
        <DetailRow
          Icon={CalendarCheck}
          color={colors.light.ink}
          label="Past 7 days"
          value={`${analytics.loggingConsistency.past7Days.loggedDays} / ${analytics.loggingConsistency.past7Days.expectedDays}`}
          detail="Days with food logged"
        />
        <DetailRow
          Icon={CalendarCheck}
          color={colors.light.muted}
          label="Past 30 days"
          value={`${analytics.loggingConsistency.past30Days.loggedDays} / ${analytics.loggingConsistency.past30Days.expectedDays}`}
          detail={`${analytics.dataCompleteness.foodLogCount} food entries`}
        />
      </View>

      <View className="gap-3">
        <SectionHeader title="Weight" />
        <DetailRow
          Icon={Scale}
          color={accent.fat}
          label="Latest"
          value={formatWeight(analytics.weightTrend.latestWeightLb)}
        />
        <DetailRow
          Icon={TrendingUp}
          color={colors.light.ink}
          label="Change"
          value={
            analytics.weightTrend.changeLb === null
              ? '—'
              : formatDifference(analytics.weightTrend.changeLb, 'lb')
          }
          detail={
            analytics.weightTrend.weeklySlopeLb === null
              ? 'Log more weights to see a weekly pace'
              : `${formatDifference(
                  analytics.weightTrend.weeklySlopeLb,
                  'lb',
                )} per week`
          }
        />
      </View>
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
  const highPriority = recommendation.severity === 'high';

  return (
    <View className="flex-row items-start gap-3 border-t border-line py-4">
      <IconDot Icon={meta.Icon} color={meta.color} filled={highPriority} />
      <View className="min-w-0 flex-1 gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <View
            className={`rounded-full px-2.5 py-1 ${
              highPriority ? 'bg-primary' : 'bg-[#F4F4F4]'
            }`}
          >
            <AppText
              variant="caption"
              className={highPriority ? 'text-white' : 'text-muted'}
            >
              {severityLabel(recommendation.severity)}
            </AppText>
          </View>
          <AppText variant="caption" className="text-muted">
            {meta.label}
          </AppText>
        </View>
        <View className="gap-1">
          <AppText variant="label" className="text-ink">
            {recommendation.title}
          </AppText>
          <AppText muted>{recommendation.message}</AppText>
        </View>
        <Pressable
          accessibilityLabel={`Dismiss recommendation: ${recommendation.title}`}
          accessibilityRole="button"
          className={`min-h-10 self-start flex-row items-center gap-2 rounded-full py-1 pr-3 active:opacity-70 ${
            disabled ? 'opacity-45' : ''
          }`}
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
      <View className="gap-5">
        <View className="flex-row items-start justify-between gap-5">
          <View className="min-w-0 flex-1 gap-3">
            <SkeletonLine width={132} height={11} />
            <View className="flex-row items-end gap-2">
              <SkeletonLine width={120} height={42} radius={14} />
              <SkeletonLine width={42} height={14} className="mb-1.5" />
            </View>
            <SkeletonLine width="88%" height={13} />
          </View>
          <SkeletonBlock width={76} height={76} radius={38} />
        </View>

        <View className="gap-4">
          {Array.from({ length: 2 }, (_, index) => (
            <View key={index} className="gap-2">
              <View className="flex-row items-end justify-between gap-3">
                <SkeletonLine width={102} height={12} />
                <SkeletonLine width={70} height={12} />
              </View>
              <SkeletonRail height={8} />
              <SkeletonLine width="56%" height={10} />
            </View>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <View className="flex-row items-end justify-between gap-3">
          <SkeletonLine width={82} height={22} />
          <SkeletonLine width={78} height={10} />
        </View>
        {Array.from({ length: 2 }, (_, index) => (
          <View key={index} className="gap-4 border-t border-line py-4">
            <View className="flex-row items-start gap-3">
              <SkeletonPill width={36} height={36} />
              <View className="min-w-0 flex-1 gap-2">
                <View className="flex-row items-center justify-between gap-3">
                  <SkeletonLine width="44%" height={13} />
                  <SkeletonLine width={54} height={10} />
                </View>
                <SkeletonLine width="82%" height={12} />
              </View>
            </View>
            <View className="gap-3 pl-12">
              <SkeletonRail height={8} />
              <SkeletonRail height={8} />
            </View>
          </View>
        ))}
      </View>

      <View className="gap-3">
        <View className="flex-row items-end justify-between gap-3">
          <View className="min-w-0 flex-1 gap-2">
            <SkeletonLine width={164} height={22} />
            <SkeletonLine width="86%" height={12} />
          </View>
          <SkeletonPill width={78} height={34} />
        </View>
        {Array.from({ length: 2 }, (_, index) => (
          <View
            key={index}
            className="flex-row items-start gap-3 border-t border-line py-4"
          >
            <SkeletonPill width={36} height={36} />
            <View className="min-w-0 flex-1 gap-2">
              <View className="flex-row flex-wrap items-center gap-2">
                <SkeletonPill width={88} height={24} />
                <SkeletonLine width={64} height={10} />
              </View>
              <SkeletonLine width="64%" height={13} />
              <SkeletonLine width="92%" height={12} />
              <SkeletonLine width={82} height={12} />
            </View>
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

export default function InsightsScreen() {
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<
    string | null
  >(null);

  const loadInsights = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setAnalyticsError(null);
    setRecommendationsError(null);

    const [analyticsResult, recommendationsResult] = await Promise.allSettled([
      api.analytics.advanced({ rangeDays: 30 }),
      (async () => {
        await api.recommendations.generate();
        return api.recommendations.list();
      })(),
    ]);

    if (analyticsResult.status === 'fulfilled') {
      setAnalytics(analyticsResult.value);
    } else {
      setAnalyticsError(errorMessage(analyticsResult.reason));
    }

    if (recommendationsResult.status === 'fulfilled') {
      setRecommendations(recommendationsResult.value);
    } else {
      setRecommendationsError(errorMessage(recommendationsResult.reason));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

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

  if (loading && analytics === null && recommendations.length === 0) {
    return <InsightsSkeleton />;
  }

  return (
    <AppScreen
      refreshing={refreshing}
      contentClassName="gap-7"
      backgroundColor="#FFFFFF"
      onRefresh={() => void loadInsights(true)}
    >
      {analyticsError === null ? null : (
        <ErrorState
          title={
            analytics === null
              ? 'Insights are unavailable'
              : 'Couldn’t refresh insights'
          }
          message={analyticsError}
          onRetry={() => void loadInsights()}
        />
      )}

      {analytics === null ? null : <AnalyticsContent analytics={analytics} />}

      <View className="gap-3">
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
            loading={loading && analytics !== null}
            disabled={loading || refreshing}
            onPress={() => void loadInsights()}
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
            onRetry={() => void loadInsights()}
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
