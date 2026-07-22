import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { StreakCalendarResponse } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { MonthlyStreakCalendar } from '@/components/monthly-streak-calendar';
import { StreakFlame } from '@/components/streak-flame';
import { api, errorMessage } from '@/lib/api-client';
import { monthLabel, shiftMonth } from '@/lib/streak-calendar-ui';
import { colors } from '@/theme/tokens';

function currentMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function boundaryLabel(calendar: StreakCalendarResponse): string {
  return `${calendar.monthBoundary.startDate} – ${calendar.monthBoundary.endDate}`;
}

export default function StreaksScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [calendar, setCalendar] = useState<StreakCalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (asRefresh = false) => {
      if (asRefresh) setRefreshing(true);
      else if (!hasLoaded.current) setLoading(true);
      setError(null);
      try {
        const nextCalendar = await api.analytics.streakCalendar(month);
        setCalendar(nextCalendar);
        hasLoaded.current = true;
      } catch (loadError) {
        setError(errorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const days = useMemo(
    () => calendar?.weeks.flatMap((week) => week.days) ?? [],
    [calendar],
  );
  const hasLoggedDayInView = days.some((day) => day.logged);
  const goldDays = days.filter((day) => day.goldDay).length;
  const goldWeeks = calendar?.weeks.filter((week) => week.goldWeek).length ?? 0;

  if (loading && calendar === null) {
    return (
      <AppScreen>
        <LoadingState message="Loading your streak calendar…" />
      </AppScreen>
    );
  }

  if (calendar === null && error !== null) {
    return (
      <AppScreen>
        <ErrorState
          title="We couldn’t load your streak"
          message={error}
          onRetry={() => void load()}
        />
      </AppScreen>
    );
  }

  if (calendar === null) return null;

  return (
    <AppScreen
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      contentClassName="gap-5"
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-surface-raised active:opacity-70"
          onPress={() => router.back()}
        >
          <AppText variant="heading" className="text-ink">
            ‹
          </AppText>
        </Pressable>
        <View className="min-w-0 flex-1">
          <AppText
            variant="caption"
            className="uppercase tracking-[1.2px] text-muted"
          >
            Streaks
          </AppText>
          <AppText variant="heading" className="text-ink">
            Your logging rhythm
          </AppText>
        </View>
        <StreakFlame size={24} />
      </View>

      {error === null ? null : (
        <ErrorState title="Couldn’t refresh your streak" message={error} />
      )}

      <View className="flex-row gap-3">
        <AppCard compact className="min-w-0 flex-1">
          <AppText
            variant="caption"
            className="uppercase tracking-[1px] text-muted"
          >
            Current logging streak
          </AppText>
          <AppText variant="display" className="text-ink tabular-nums">
            {calendar.currentStreak.loggedDays}
          </AppText>
          <AppText variant="caption" muted>
            {calendar.currentStreak.loggedDays === 1 ? 'day' : 'days'} logged
          </AppText>
        </AppCard>
        <AppCard compact className="min-w-0 flex-1">
          <AppText
            variant="caption"
            className="uppercase tracking-[1px] text-muted"
          >
            Longest logging streak
          </AppText>
          <AppText variant="display" className="text-ink tabular-nums">
            {calendar.currentStreak.longestLoggedDays}
          </AppText>
          <AppText variant="caption" muted>
            independent of calorie gold
          </AppText>
        </AppCard>
      </View>

      <AppCard compact className="gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border active:opacity-70"
            onPress={() => setMonth((value) => shiftMonth(value, -1))}
          >
            <ChevronLeft color={colors.light.ink} size={20} />
          </Pressable>
          <View className="items-center">
            <AppText variant="heading" className="text-ink">
              {monthLabel(calendar.requestedMonth)}
            </AppText>
            <AppText variant="caption" muted>
              {boundaryLabel(calendar)} · Sunday–Saturday
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border active:opacity-70"
            onPress={() => setMonth((value) => shiftMonth(value, 1))}
          >
            <ChevronRight color={colors.light.ink} size={20} />
          </Pressable>
        </View>
        <MonthlyStreakCalendar calendar={calendar} />
      </AppCard>

      {calendar.activeCalorieTarget === null ? (
        <EmptyState
          title="No calorie target yet"
          message="Logging still counts toward your streak. Add a goal to see partial, gold, and over-target calorie states."
          symbol="○"
        />
      ) : (
        <AppCard compact className="gap-1">
          <AppText variant="label" className="text-ink">
            Calorie completion
          </AppText>
          <AppText variant="caption" muted>
            Gold days are inside the accepted range of{' '}
            {calendar.acceptedCalorieRange?.lowerCalories.toLocaleString(
              'en-US',
            )}
            –
            {calendar.acceptedCalorieRange?.upperCalories.toLocaleString(
              'en-US',
            )}{' '}
            kcal. Grace preserves logging continuity but never becomes gold.
          </AppText>
          <AppText variant="caption" className="text-muted">
            {goldDays} gold day{goldDays === 1 ? '' : 's'} · {goldWeeks} perfect
            week{goldWeeks === 1 ? '' : 's'} this view
          </AppText>
        </AppCard>
      )}

      {!hasLoggedDayInView ? (
        <EmptyState
          title="No logs in this month yet"
          message="Your calendar is ready. Log a meal to start building a logging streak."
        />
      ) : null}

      <AppButton variant="ghost" onPress={() => void load(true)}>
        Refresh streak
      </AppButton>
    </AppScreen>
  );
}
