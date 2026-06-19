import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DashboardSummary } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppLogo } from '@/components/app-logo';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { MacroProgressBar } from '@/components/macro-progress-bar';
import { ProgressRing } from '@/components/progress-ring';
import { ScreenHeader } from '@/components/screen-header';
import { StatCard } from '@/components/stat-card';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

export default function ProgressScreen() {
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummary = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      setSummary(await api.dashboard.summary());
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

  return (
    <AppScreen refreshing={refreshing} onRefresh={() => void loadSummary(true)}>
      <ScreenHeader
        eyebrow={formattedDate(summary.date)}
        title="Good morning, Alex"
        action={<AppLogo size={40} />}
      />

      {error === null ? null : (
        <ErrorState title="Couldn’t refresh progress" message={error} />
      )}

      <AppCard elevated compact className="gap-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-1">
            <AppText variant="caption" muted>
              DAILY ENERGY
            </AppText>
            <AppText variant="display" className="tabular-nums">
              {summary.caloriesConsumed.toLocaleString()}
            </AppText>
            <AppText muted>kilocalories consumed</AppText>
          </View>
          <ProgressRing
            value={calorieProgress}
            label="of daily target"
            displayValue={`${Math.round(calorieProgress * 100)}%`}
            size={108}
          />
        </View>

        <View className="h-px bg-border" />

        <View className="flex-row gap-3">
          <View className="flex-1 gap-1">
            <AppText variant="caption" muted>
              TARGET
            </AppText>
            <AppText variant="heading" className="tabular-nums">
              {summary.calorieTarget?.toLocaleString() ?? '—'}
            </AppText>
          </View>
          <View className="flex-1 gap-1">
            <AppText variant="caption" muted>
              REMAINING
            </AppText>
            <AppText variant="heading" className="tabular-nums">
              {summary.caloriesRemaining?.toLocaleString() ?? '—'}
            </AppText>
          </View>
        </View>
      </AppCard>

      <View className="gap-2.5">
        <AppText variant="heading">Nutrition</AppText>
        <AppCard compact>
          <MacroProgressBar
            label="Protein"
            consumed={summary.proteinConsumed}
            target={summary.proteinTarget}
          />
          <View className="mt-4 flex-row justify-between">
            <AppText variant="caption" muted>
              Remaining
            </AppText>
            <AppText variant="label" className="tabular-nums">
              {summary.proteinRemaining?.toFixed(1) ?? '—'} g
            </AppText>
          </View>
        </AppCard>
      </View>

      <View className="gap-2.5">
        <AppText variant="heading">Today at a glance</AppText>
        <View className="flex-row flex-wrap gap-3">
          <StatCard
            label="LATEST WEIGHT"
            value={
              summary.latestWeightLb === null
                ? 'No entry'
                : `${summary.latestWeightLb.toFixed(1)} lb`
            }
            detail="Most recent log"
            accent="clay"
          />
          <StatCard
            label="TRACKING MODE"
            value={summary.trackingMode === 'simple' ? 'Simple' : 'Complex'}
            detail="Nutrition detail level"
          />
        </View>
      </View>
    </AppScreen>
  );
}
