import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  DailyNutrientTotals,
  DashboardSummary,
  Profile,
  ProgressResponse,
  ReportsResponse,
  TrackingMode,
  TrackingPreferences,
} from '@food-tracker/shared';
import { AppLogo } from '@/components/app-logo';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ProgressCalorieHero } from '@/components/progress-reporting-summary';
import { ProgressReportingSummary } from '@/components/progress-reporting-summary';
import {
  ReportingIcon,
  type ReportingIconName,
} from '@/components/reporting-icon';
import { StreakEntryAction } from '@/components/streak-entry-action';
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { syncLauncherIconToMode } from '@/lib/app-icon';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
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

function SignalRow({
  icon,
  label,
  detail,
  value,
}: {
  icon: ReportingIconName;
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <View className="border-t border-line py-4">
      <View className="flex-row items-center gap-3">
        <ReportingIcon name={icon} size={36} />
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
        {Array.from({ length: 3 }, (_, index) => (
          <View key={index} className="border-t border-line py-4">
            <View className="flex-row items-center gap-3">
              <SkeletonPill width={36} height={36} />
              <View className="min-w-0 flex-1 gap-2">
                <SkeletonLine width="48%" height={13} />
                <SkeletonLine width="72%" height={10} />
              </View>
              <SkeletonLine width={74} height={14} />
            </View>
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

export default function ProgressScreen() {
  const router = useRouter();
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
  const [reporting, setReporting] = useState<ProgressResponse | null>(null);
  const [reportingError, setReportingError] = useState<string | null>(null);
  const [reportingLoading, setReportingLoading] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState<ReportsResponse | null>(
    null,
  );
  const [weeklyReportError, setWeeklyReportError] = useState<string | null>(
    null,
  );
  const [dailyNutrients, setDailyNutrients] =
    useState<DailyNutrientTotals | null>(null);
  const [dailyNutrientsError, setDailyNutrientsError] = useState<string | null>(
    null,
  );

  const loadSummary = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setReportingError(null);
    setWeeklyReportError(null);
    setDailyNutrientsError(null);
    setReportingLoading(true);

    let loadedSummary: DashboardSummary | null = null;
    try {
      const [nextSummary, nextProfile, nextPreferences] = await Promise.all([
        api.dashboard.summary(),
        api.profile.get(),
        api.trackingPreferences.get(),
      ]);
      setSummary(nextSummary);
      loadedSummary = nextSummary;
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
    }

    if (loadedSummary === null) {
      setReportingLoading(false);
      setRefreshing(false);
      return;
    }

    const [progressResult, weeklyResult, dailyResult] =
      await Promise.allSettled([
        api.analytics.progress(),
        api.analytics.reports({ period: 'week' }),
        api.analytics.dailyNutrients({ date: loadedSummary.date }),
      ]);

    if (progressResult.status === 'fulfilled') {
      setReporting(progressResult.value);
    } else {
      setReportingError(errorMessage(progressResult.reason));
    }
    if (weeklyResult.status === 'fulfilled') {
      setWeeklyReport(weeklyResult.value);
    } else {
      setWeeklyReportError(errorMessage(weeklyResult.reason));
    }
    if (dailyResult.status === 'fulfilled') {
      setDailyNutrients(dailyResult.value);
    } else {
      setDailyNutrientsError(errorMessage(dailyResult.reason));
    }
    setReportingLoading(false);
    setRefreshing(false);
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

  const entriesLabel =
    summary.foodLogCount === 1
      ? '1 entry'
      : `${summary.foodLogCount.toLocaleString('en-US')} entries`;
  const weightValue =
    summary.latestWeightLb === null
      ? 'No entry'
      : `${summary.latestWeightLb.toFixed(1)} lb`;
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

      <View className="flex-row items-end justify-between gap-3">
        <AppText
          variant="title"
          className="text-[38px] leading-[46px] text-ink"
        >
          Progress
        </AppText>
        {reporting === null ? null : (
          <StreakEntryAction
            currentStreak={reporting.currentStreak.loggedDays}
          />
        )}
      </View>

      {error === null ? null : (
        <ErrorState title="Couldn’t refresh progress" message={error} />
      )}

      <ProgressCalorieHero summary={summary} weeklyReport={weeklyReport} />

      <AppCard elevated className="gap-0">
        <SignalRow
          icon="food"
          label="Food entries"
          detail={
            summary.foodLogCount === 0 ? 'No food logged yet' : 'Logged today'
          }
          value={entriesLabel}
        />
        <SignalRow
          icon="weight"
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
            icon="detail"
            label="Tracking detail"
            detail="Detailed fields are available when you log food."
            value="Detailed"
          />
        ) : null}
      </AppCard>

      {reportingError === null && reporting === null && reportingLoading ? (
        <View className="border-t border-line pt-6">
          <SkeletonLine width={128} height={14} />
        </View>
      ) : reportingError !== null ? (
        <View className="border-t border-line pt-5">
          <ErrorState
            title="Reporting is unavailable"
            message={reportingError}
            onRetry={() => void loadSummary(true)}
          />
        </View>
      ) : reporting === null ? null : (
        <ProgressReportingSummary
          summary={summary}
          reporting={reporting}
          weeklyReport={weeklyReport}
          dailyNutrients={dailyNutrients}
          weeklyReportError={weeklyReportError}
          dailyNutrientsError={dailyNutrientsError}
          onRetry={() => void loadSummary(true)}
          onReports={() => router.push('/(tabs)/insights')}
        />
      )}

      <View className="border-t border-line pt-5">
        <AppText variant="caption" className="text-center text-muted">
          Use + to log food or weight.
        </AppText>
      </View>
    </AppScreen>
  );
}
