import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type {
  DashboardSummary,
  Profile,
  TrackingPreferences,
  TrackingMode,
} from '@food-tracker/shared';
import { AppLogo } from '@/components/app-logo';
import { AppModule } from '@/components/app-module';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function TargetRail({
  progress,
  inverted = false,
}: {
  progress: number;
  inverted?: boolean;
}) {
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <View className="gap-3">
      <View
        className={`h-3 overflow-hidden rounded-full ${
          inverted ? 'bg-white/15' : 'bg-module-muted'
        }`}
      >
        <View
          className={`h-full rounded-full ${inverted ? 'bg-white' : 'bg-primary'}`}
          style={{ width: `${clampedProgress * 100}%` }}
        />
      </View>
      <View className="flex-row justify-between">
        <AppText
          variant="caption"
          className={inverted ? 'text-white/50' : 'text-muted'}
        >
          Logged
        </AppText>
        <AppText
          variant="caption"
          className={inverted ? 'text-white/50' : 'text-muted'}
        >
          Target
        </AppText>
      </View>
    </View>
  );
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
      className={`flex-row items-center gap-2 rounded-full bg-module px-3 py-2 active:opacity-70 ${
        switching ? 'opacity-55' : ''
      }`}
      disabled={switching}
      onPress={onPress}
    >
      <AppLogo mode={simple ? 'simple' : 'complex'} size={24} />
      <AppText variant="caption" className="text-ink">
        {simple ? 'Simple' : 'Detailed'}
      </AppText>
      <AppText variant="caption" className="text-muted">
        Switch
      </AppText>
    </Pressable>
  );
}

function MetricModule({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <AppModule className="min-w-[148px] flex-1 gap-2">
      <AppText
        variant="caption"
        className="text-muted uppercase tracking-[1.4px]"
      >
        {label}
      </AppText>
      <AppText variant="heading" className="text-ink tabular-nums">
        {value}
      </AppText>
      <AppText variant="caption" className="text-muted">
        {detail}
      </AppText>
    </AppModule>
  );
}

export default function ProgressScreen() {
  const dataVersion = useAppStore((state) => state.dataVersion);
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
    return (
      <AppScreen>
        <LoadingState message="Loading today’s progress…" />
      </AppScreen>
    );
  }

  if (error !== null && summary === null) {
    return (
      <AppScreen>
        <ErrorState
          title="Today’s progress is unavailable"
          message={error}
          onRetry={() => void loadSummary()}
        />
      </AppScreen>
    );
  }

  if (summary === null) {
    return null;
  }

  const calorieProgress =
    summary.calorieTarget === null || summary.calorieTarget <= 0
      ? 0
      : summary.caloriesConsumed / summary.calorieTarget;
  const greetingName = profile?.name.trim();
  const greeting =
    greetingName === undefined || greetingName === ''
      ? 'Good morning'
      : `Good morning, ${greetingName}`;
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
    } catch (switchError) {
      setPreferences(previousPreferences);
      setSummary(previousSummary);
      setError(errorMessage(switchError));
    } finally {
      setSwitchingMode(false);
    }
  };

  return (
    <AppScreen
      refreshing={refreshing}
      contentClassName="gap-7"
      onRefresh={() => void loadSummary(true)}
    >
      <View className="flex-row items-center justify-between gap-4">
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="caption" className="text-muted">
            {formattedDate(summary.date)}
          </AppText>
          <AppText variant="title" className="text-ink">
            {greeting}
          </AppText>
        </View>
        <ModeBadge
          mode={summary.trackingMode}
          switching={switchingMode}
          onPress={() => void toggleMode()}
        />
      </View>

      {error === null ? null : (
        <ErrorState title="Couldn’t refresh progress" message={error} />
      )}

      <AppModule tone="dark" className="gap-7 px-6 py-7">
        <View className="gap-2">
          <AppText
            variant="caption"
            className="text-white/60 uppercase tracking-[1.5px]"
          >
            Daily energy
          </AppText>
          <View className="flex-row items-end gap-2">
            <AppText variant="hero" className="text-white tabular-nums">
              {summary.caloriesConsumed.toLocaleString()}
            </AppText>
            <AppText variant="label" className="pb-2 text-white/65">
              kcal
            </AppText>
          </View>
          <AppText className="text-white/70">
            {summary.caloriesRemaining === null
              ? 'Set up a daily target to track your balance.'
              : `${summary.caloriesRemaining.toLocaleString()} kcal remaining today.`}
          </AppText>
        </View>

        <View className="gap-4">
          <TargetRail progress={calorieProgress} inverted />
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-[24px] bg-white/10 px-4 py-3">
              <AppText
                variant="caption"
                className="text-white/55 uppercase tracking-[1.3px]"
              >
                Target
              </AppText>
              <AppText variant="heading" className="text-white tabular-nums">
                {summary.calorieTarget?.toLocaleString() ?? '—'}
              </AppText>
            </View>
            <View className="flex-1 rounded-[24px] bg-white/10 px-4 py-3">
              <AppText
                variant="caption"
                className="text-white/55 uppercase tracking-[1.3px]"
              >
                Entries
              </AppText>
              <AppText variant="heading" className="text-white tabular-nums">
                {summary.foodLogCount}
              </AppText>
            </View>
          </View>
        </View>
        <AppText variant="caption" className="text-white/55">
          {summary.foodLogCount === 0
            ? 'No food has been logged for today yet.'
            : `Based on ${summary.foodLogCount} food ${
                summary.foodLogCount === 1 ? 'entry' : 'entries'
              } logged today.`}
        </AppText>
      </AppModule>

      <View className="gap-3">
        <View className="flex-row items-end justify-between">
          <AppText variant="heading" className="text-ink">
            Today’s signals
          </AppText>
          <AppText variant="caption" className="text-muted">
            Live from your logs
          </AppText>
        </View>
        <AppModule className="gap-5">
          <View className="flex-1 gap-1">
            <View className="flex-row items-end justify-between gap-4">
              <View>
                <AppText
                  variant="caption"
                  className="text-muted uppercase tracking-[1.4px]"
                >
                  Protein
                </AppText>
                <AppText variant="display" className="text-ink tabular-nums">
                  {summary.proteinConsumed.toFixed(0)}
                  <AppText variant="heading" className="text-muted">
                    {' '}
                    g
                  </AppText>
                </AppText>
              </View>
              <AppText variant="label" className="text-muted tabular-nums">
                {summary.proteinTarget?.toFixed(0) ?? '—'} g target
              </AppText>
            </View>
            <View className="mt-2 h-2.5 overflow-hidden rounded-full bg-module-muted">
              <View
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${
                    summary.proteinTarget === null || summary.proteinTarget <= 0
                      ? 0
                      : Math.min(
                          (summary.proteinConsumed / summary.proteinTarget) *
                            100,
                          100,
                        )
                  }%`,
                }}
              />
            </View>
            <AppText variant="caption" className="text-muted">
              {summary.proteinRemaining === null
                ? 'No protein target available.'
                : `${summary.proteinRemaining.toFixed(1)} g remaining.`}
            </AppText>
          </View>
        </AppModule>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <MetricModule
          label="Weight"
          value={
            summary.latestWeightLb === null
              ? 'No entry'
              : `${summary.latestWeightLb.toFixed(1)} lb`
          }
          detail="Most recent log"
        />
        <MetricModule
          label="Mode"
          value={summary.trackingMode === 'simple' ? 'Simple' : 'Detailed'}
          detail="Daily log detail"
        />
      </View>

      <AppModule tone="muted" className="gap-2">
        <View className="flex-row items-center justify-between gap-4">
          <View className="min-w-0 flex-1">
            <AppText variant="heading" className="text-ink">
              Ready for the next log
            </AppText>
            <AppText className="mt-1 text-muted">
              Add food or weight from the center action when you’re ready.
            </AppText>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
            <AppText variant="heading" className="text-white leading-6">
              +
            </AppText>
          </View>
        </View>
      </AppModule>
    </AppScreen>
  );
}
