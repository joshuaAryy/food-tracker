import type { ComponentType } from 'react';
import { useCallback, useState } from 'react';
import { Pressable, View, type DimensionValue } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type {
  DashboardSummary,
  Profile,
  TrackingMode,
  TrackingPreferences,
} from '@food-tracker/shared';
import {
  Beef,
  Flame,
  Scale,
  SlidersHorizontal,
  Utensils,
} from 'lucide-react-native';
import { AppLogo } from '@/components/app-logo';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { syncLauncherIconToMode } from '@/lib/app-icon';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

const INK = colors.light.ink;
const RAIL = '#E9E7E2';
const CALORIE = '#B86F5F';
const PROTEIN = '#6F927A';
const WEIGHT = '#637D96';
const WARM = '#B18A50';

type LucideIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type DailyStatus = {
  number: string;
  unit: string;
  phrase: string;
  detail: string;
};

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function formatWhole(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatGrams(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} g`;
}

function boundedProgress(value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(value, 1));
}

function calorieProgress(summary: DashboardSummary): number {
  if (summary.calorieTarget === null || summary.calorieTarget <= 0) {
    return 0;
  }

  return boundedProgress(summary.caloriesConsumed / summary.calorieTarget);
}

function proteinProgress(summary: DashboardSummary): number {
  if (summary.proteinTarget === null || summary.proteinTarget <= 0) {
    return 0;
  }

  return boundedProgress(summary.proteinConsumed / summary.proteinTarget);
}

function dailyStatus(summary: DashboardSummary): DailyStatus {
  if (summary.calorieTarget === null || summary.calorieTarget <= 0) {
    return {
      number: formatWhole(summary.caloriesConsumed),
      unit: 'kcal logged',
      phrase:
        summary.foodLogCount === 0
          ? 'Day is still building'
          : 'Your day is taking shape',
      detail:
        summary.foodLogCount === 0
          ? 'Add your first meal to start the day.'
          : `${formatWhole(summary.caloriesConsumed)} kcal logged so far.`,
    };
  }

  if (summary.caloriesRemaining === null) {
    return {
      number: formatWhole(summary.caloriesConsumed),
      unit: 'kcal logged',
      phrase: 'Your day is taking shape',
      detail: `${formatWhole(summary.caloriesConsumed)} of ${formatWhole(
        summary.calorieTarget,
      )} kcal logged.`,
    };
  }

  if (summary.caloriesRemaining < 0) {
    return {
      number: formatWhole(Math.abs(summary.caloriesRemaining)),
      unit: 'kcal over',
      phrase: 'Over today’s target',
      detail: `${formatWhole(summary.caloriesConsumed)} of ${formatWhole(
        summary.calorieTarget,
      )} kcal logged.`,
    };
  }

  if (summary.foodLogCount === 0) {
    return {
      number: formatWhole(summary.calorieTarget),
      unit: 'kcal target',
      phrase: 'Day is still building',
      detail: 'No food logged yet.',
    };
  }

  const progress = summary.caloriesConsumed / summary.calorieTarget;
  const phrase =
    progress >= 1
      ? 'Goal reached'
      : progress >= 0.82
        ? 'Almost there'
        : progress >= 0.35
          ? 'You’re on track'
          : 'Day is still building';

  return {
    number: formatWhole(summary.caloriesRemaining),
    unit: 'kcal left',
    phrase,
    detail: `${formatWhole(summary.caloriesConsumed)} of ${formatWhole(
      summary.calorieTarget,
    )} kcal logged.`,
  };
}

function ModeBadge({
  mode,
  switching,
  onPress,
}: {
  mode: DashboardSummary['trackingMode'];
  switching: boolean;
  onPress: () => void;
}) {
  const simple = mode === 'simple';

  return (
    <Pressable
      accessibilityLabel={`Switch tracking mode. Current mode is ${
        simple ? 'Simple' : 'Detailed'
      }.`}
      accessibilityRole="button"
      className={`flex-row items-center gap-2 rounded-full border border-line bg-white px-3 py-2 active:opacity-70 ${
        switching ? 'opacity-55' : ''
      }`}
      disabled={switching}
      onPress={onPress}
    >
      <AppLogo mode={simple ? 'simple' : 'complex'} size={23} />
      <AppText variant="caption" className="text-ink">
        {simple ? 'Simple' : 'Detailed'}
      </AppText>
    </Pressable>
  );
}

function StatusPill({ children }: { children: string }) {
  return (
    <View className="self-start rounded-full border border-line bg-white px-3 py-1.5">
      <AppText variant="caption" className="text-ink">
        {children}
      </AppText>
    </View>
  );
}

function ProgressRail({
  progress,
  color,
  startLabel,
  endLabel,
}: {
  progress: number;
  color: string;
  startLabel: string;
  endLabel: string;
}) {
  const width = `${boundedProgress(progress) * 100}%` as DimensionValue;

  return (
    <View className="gap-3">
      <View
        className="h-2.5 overflow-hidden rounded-full"
        style={{ backgroundColor: RAIL }}
      >
        <View
          className="h-full rounded-full"
          style={{ width, backgroundColor: color }}
        />
      </View>
      <View className="flex-row justify-between gap-3">
        <AppText variant="caption" className="text-muted">
          {startLabel}
        </AppText>
        <AppText variant="caption" className="text-muted">
          {endLabel}
        </AppText>
      </View>
    </View>
  );
}

function SignalRow({
  icon: Icon,
  accent,
  label,
  detail,
  value,
  progress,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  detail: string;
  value: string;
  progress?: number;
}) {
  return (
    <View className="border-t border-line py-4">
      <View className="flex-row items-center gap-3">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}18` }}
        >
          <Icon color={accent} size={18} strokeWidth={2.2} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <AppText variant="label" className="text-ink">
            {label}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {detail}
          </AppText>
        </View>
        <AppText variant="label" className="text-ink tabular-nums">
          {value}
        </AppText>
      </View>
      {progress === undefined ? null : (
        <View
          className="ml-12 mt-3 h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: RAIL }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${boundedProgress(progress) * 100}%` as DimensionValue,
              backgroundColor: accent,
            }}
          />
        </View>
      )}
    </View>
  );
}

function ProgressSkeleton() {
  return (
    <AppScreen contentClassName="gap-8">
      <View className="flex-row items-center justify-between gap-4 pt-1">
        <SkeletonLine width={168} height={13} />
        <SkeletonPill width={104} height={39} />
      </View>

      <View className="gap-6">
        <View className="gap-4">
          <SkeletonPill width={128} height={29} />
          <View className="gap-3">
            <View className="flex-row items-end gap-3">
              <SkeletonLine width={132} height={64} radius={18} />
              <SkeletonLine width={64} height={16} className="mb-3" />
            </View>
            <SkeletonLine width="76%" height={14} />
          </View>
        </View>

        <View className="gap-3">
          <SkeletonRail height={10} />
          <View className="flex-row justify-between gap-3">
            <SkeletonLine width={76} height={10} />
            <SkeletonLine width={92} height={10} />
          </View>
        </View>
      </View>

      <View className="gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <View key={index} className="border-t border-line py-4">
            <View className="flex-row items-center gap-3">
              <SkeletonPill width={36} height={36} />
              <View className="min-w-0 flex-1 gap-2">
                <SkeletonLine width="48%" height={13} />
                <SkeletonLine width="72%" height={10} />
              </View>
              <SkeletonLine width={74} height={14} />
            </View>
            {index === 1 ? (
              <View className="ml-12 mt-3">
                <SkeletonRail height={6} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

export default function ProgressScreen() {
  const dataVersion = useAppStore((state) => state.dataVersion);
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<TrackingPreferences | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  const loadSummary = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [nextSummary, nextProfile, nextPreferences] = await Promise.all([
        api.dashboard.summary(),
        api.profile.get(),
        api.trackingPreferences.get(),
      ]);
      setSummary(nextSummary);
      setProfile(nextProfile);
      setPreferences(nextPreferences);
      void syncLauncherIconToMode(nextPreferences.mode).catch(
        (iconSyncError: unknown) => {
          console.warn('Unable to sync launcher icon', iconSyncError);
        },
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [dataVersion, loadSummary]),
  );

  if (loading && summary === null) {
    return <ProgressSkeleton />;
  }

  if (error !== null && summary === null) {
    return (
      <AppScreen>
        <ErrorState
          title="We couldn’t load today’s progress"
          message={error}
          onRetry={() => void loadSummary()}
        />
      </AppScreen>
    );
  }

  if (summary === null) {
    return null;
  }

  const toggleMode = async () => {
    if (preferences === null || switchingMode) return;

    const previousSummary = summary;
    const previousPreferences = preferences;
    const nextMode: TrackingMode =
      summary.trackingMode === 'simple' ? 'complex' : 'simple';
    const nextPreferences = { ...preferences, mode: nextMode };
    setSwitchingMode(true);
    setError(null);
    setPreferences(nextPreferences);
    setSummary({ ...summary, trackingMode: nextMode });

    try {
      const savedPreferences =
        await api.trackingPreferences.update(nextPreferences);
      setPreferences(savedPreferences);
      setSummary((current) =>
        current === null
          ? current
          : { ...current, trackingMode: savedPreferences.mode },
      );
      markDataChanged();

      try {
        await syncLauncherIconToMode(savedPreferences.mode);
      } catch (iconSyncError) {
        setError(
          `Tracking mode was saved, but the launcher icon could not be updated. ${errorMessage(
            iconSyncError,
          )}`,
        );
      }
    } catch (switchError) {
      setPreferences(previousPreferences);
      setSummary(previousSummary);
      setError(errorMessage(switchError));
    } finally {
      setSwitchingMode(false);
    }
  };

  const status = dailyStatus(summary);
  const entriesLabel =
    summary.foodLogCount === 1
      ? '1 entry'
      : `${summary.foodLogCount.toLocaleString('en-US')} entries`;
  const weightValue =
    summary.latestWeightLb === null
      ? 'No entry'
      : `${summary.latestWeightLb.toFixed(1)} lb`;
  const calorieTargetLabel =
    summary.calorieTarget === null || summary.calorieTarget <= 0
      ? 'Target'
      : `${formatWhole(summary.calorieTarget)} kcal`;
  const proteinTargetLabel =
    summary.proteinTarget === null || summary.proteinTarget <= 0
      ? 'No target'
      : `${formatGrams(summary.proteinTarget)} target`;
  const proteinDetail =
    summary.proteinRemaining === null
      ? proteinTargetLabel
      : summary.proteinRemaining <= 0
        ? 'Protein target reached'
        : `${formatGrams(summary.proteinRemaining)} left`;
  const modeIsDetailed = summary.trackingMode === 'complex';

  return (
    <AppScreen
      refreshing={refreshing}
      contentClassName="gap-8"
      onRefresh={() => void loadSummary(true)}
    >
      <View className="flex-row items-center justify-between gap-4 pt-1">
        <AppText variant="caption" className="text-muted">
          {formattedDate(summary.date)}
        </AppText>
        <ModeBadge
          mode={summary.trackingMode}
          switching={switchingMode}
          onPress={() => void toggleMode()}
        />
      </View>

      {error === null ? null : (
        <ErrorState title="Couldn’t refresh progress" message={error} />
      )}

      <View className="gap-6">
        <View className="gap-4">
          <StatusPill>{status.phrase}</StatusPill>
          <View className="gap-1">
            <View className="flex-row items-end gap-2">
              <AppText
                variant="hero"
                className="text-[64px] leading-[68px] text-ink tabular-nums"
              >
                {status.number}
              </AppText>
              <AppText variant="label" className="pb-3 text-muted">
                {status.unit}
              </AppText>
            </View>
            <AppText className="max-w-[300px] text-muted">
              {status.detail}
            </AppText>
          </View>
        </View>

        <ProgressRail
          progress={calorieProgress(summary)}
          color={CALORIE}
          startLabel={summary.foodLogCount === 0 ? 'Not started' : 'Logged'}
          endLabel={calorieTargetLabel}
        />
      </View>

      <View className="gap-1">
        <SignalRow
          icon={Flame}
          accent={CALORIE}
          label="Calories"
          detail={
            summary.caloriesRemaining === null
              ? 'Food energy logged today'
              : summary.caloriesRemaining < 0
                ? `${formatWhole(Math.abs(summary.caloriesRemaining))} kcal over`
                : `${formatWhole(summary.caloriesRemaining)} kcal left`
          }
          value={`${formatWhole(summary.caloriesConsumed)} kcal`}
        />
        <SignalRow
          icon={Beef}
          accent={PROTEIN}
          label="Protein"
          detail={proteinDetail}
          value={formatGrams(summary.proteinConsumed)}
          progress={proteinProgress(summary)}
        />
        <SignalRow
          icon={Utensils}
          accent={WARM}
          label="Food entries"
          detail={
            summary.foodLogCount === 0 ? 'No food logged yet' : 'Logged today'
          }
          value={entriesLabel}
        />
        <SignalRow
          icon={Scale}
          accent={WEIGHT}
          label="Latest weight"
          detail={
            summary.latestWeightLb === null
              ? 'Use + to log weight'
              : 'Most recent entry'
          }
          value={weightValue}
        />
        {modeIsDetailed ? (
          <SignalRow
            icon={SlidersHorizontal}
            accent={INK}
            label="Tracking detail"
            detail="Detailed fields are available when you log food."
            value="Detailed"
          />
        ) : null}
      </View>

      <View className="border-t border-line pt-5">
        <AppText variant="caption" className="text-center text-muted">
          Use + to log food or weight.
        </AppText>
      </View>
    </AppScreen>
  );
}
