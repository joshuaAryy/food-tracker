import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { StreakCalendarResponse } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { GraceLaurelIcon } from '@/components/grace-laurel-icon';
import { LoadingState } from '@/components/loading-state';
import { MonthlyStreakCalendar } from '@/components/monthly-streak-calendar';
import { StreakDayDetailSheet } from '@/components/streak-day-detail-sheet';
import { StreakFlame } from '@/components/streak-flame';
import { api, errorMessage } from '@/lib/api-client';
import {
  monthLabel,
  shiftMonth,
  type StreakCalendarDay,
} from '@/lib/streak-calendar-ui';
import { colors } from '@/theme/tokens';

function currentMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function supportingStatus(calendar: StreakCalendarResponse): {
  title: string;
  message: string;
} {
  const { currentStreak } = calendar;

  if (!currentStreak.graceUsed) {
    return {
      title: 'Grace day available',
      message:
        'One missed day can preserve a streak span, but it never adds a logged day.',
    };
  }

  if (currentStreak.todayOpen) {
    return {
      title: 'Today is still open',
      message: 'Your streak stays non-breaking until your local day ends.',
    };
  }

  const distance = Math.max(
    currentStreak.longestLoggedDays - currentStreak.loggedDays,
    0,
  );

  if (distance === 0) {
    return {
      title: 'At your longest streak',
      message: 'Keep logging to extend your personal best.',
    };
  }

  return {
    title: `${distance} ${distance === 1 ? 'day' : 'days'} to your longest streak`,
    message: `Your longest streak is ${currentStreak.longestLoggedDays} ${currentStreak.longestLoggedDays === 1 ? 'day' : 'days'}.`,
  };
}

export default function StreaksScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [calendar, setCalendar] = useState<StreakCalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<StreakCalendarDay | null>(
    null,
  );
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

  const changeMonth = (delta: number) => {
    setSelectedDay(null);
    setMonth((value) => shiftMonth(value, delta));
  };

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

  const status = supportingStatus(calendar);
  const graceAvailable = !calendar.currentStreak.graceUsed;
  const selectedGoldWeek =
    selectedDay === null
      ? false
      : calendar.weeks.some(
          (week) =>
            week.goldWeek &&
            week.days.some((day) => day.date === selectedDay.date),
        );

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
          <ChevronLeft color={colors.light.ink} size={20} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <AppText variant="heading" className="text-[24px] leading-8 text-ink">
            Streak
          </AppText>
        </View>
      </View>

      {error === null ? null : (
        <ErrorState title="Couldn’t refresh your streak" message={error} />
      )}

      <AppCard
        elevated
        className="flex-row items-center justify-between gap-4 rounded-[22px]"
      >
        <View className="min-w-0 flex-1 gap-1">
          <AppText
            variant="hero"
            className="text-[60px] leading-[64px] text-ink tabular-nums"
          >
            {calendar.currentStreak.loggedDays}
          </AppText>
          <AppText variant="label" className="text-[16px] text-ink">
            day logging streak
          </AppText>
          <AppText variant="caption" className="text-muted">
            {calendar.currentStreak.todayOpen
              ? 'Keep today open until you log.'
              : status.message}
          </AppText>
        </View>
        <StreakFlame size={78} />
      </AppCard>

      <AppCard elevated className="flex-row items-center gap-4">
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="caption" className="font-bold text-muted">
            LONGEST
          </AppText>
          <AppText variant="number" className="text-[28px] leading-9 text-ink">
            {calendar.currentStreak.longestLoggedDays}{' '}
            {calendar.currentStreak.longestLoggedDays === 1 ? 'day' : 'days'}
          </AppText>
        </View>
        <View className="min-w-0 flex-1 flex-row items-center gap-2 border-l border-line pl-4">
          <GraceLaurelIcon size={44} />
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="font-bold text-muted">
              GRACE DAY
            </AppText>
            <AppText variant="label" className="text-ink">
              {graceAvailable ? 'Available' : 'Used'}
            </AppText>
            <AppText variant="caption" className="text-muted">
              Protects one missed day
            </AppText>
          </View>
        </View>
      </AppCard>
      <View
        accessible
        accessibilityLabel={`${status.title}. ${status.message}`}
        className="gap-1 rounded-control border border-border px-4 py-3"
      >
        <AppText variant="label" className="text-ink">
          {status.title}
        </AppText>
        <AppText variant="caption" className="text-muted">
          {status.message}
        </AppText>
      </View>

      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border active:opacity-70"
            onPress={() => changeMonth(-1)}
          >
            <ChevronLeft color={colors.light.ink} size={20} />
          </Pressable>
          <View className="min-w-0 flex-1 items-center px-2">
            <AppText variant="heading" className="text-ink">
              {monthLabel(calendar.requestedMonth)}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border active:opacity-70"
            onPress={() => changeMonth(1)}
          >
            <ChevronRight color={colors.light.ink} size={20} />
          </Pressable>
        </View>
        <View style={{ marginHorizontal: -16 }}>
          <MonthlyStreakCalendar
            calendar={calendar}
            onDayPress={setSelectedDay}
          />
        </View>
      </View>

      <StreakDayDetailSheet
        day={selectedDay}
        visible={selectedDay !== null}
        activeCalorieTarget={calendar.activeCalorieTarget}
        acceptedCalorieRange={calendar.acceptedCalorieRange}
        goldWeek={selectedGoldWeek}
        onClose={() => setSelectedDay(null)}
      />
    </AppScreen>
  );
}
