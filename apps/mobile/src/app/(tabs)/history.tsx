import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  DEFAULT_TIMEZONE,
  MEAL_TYPES,
  type FoodLog,
  type MealType,
  type WeightLog,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { addLocalDateDays, todayInTimezone } from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';

function time(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function selectedDateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function mealLabel(mealType: MealType): string {
  return `${mealType[0]?.toUpperCase()}${mealType.slice(1)}`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimezone = useCallback(async () => {
    try {
      return (await api.profile.get()).timezone;
    } catch {
      return DEFAULT_TIMEZONE;
    }
  }, []);

  const loadHistory = useCallback(async (date: string, asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [nextFoods, nextWeights] = await Promise.all([
        api.foodLogs.list({ date }),
        api.weightLogs.list({ date }),
      ]);
      setFoods(nextFoods);
      setWeights(nextWeights);
      setLoadedDate(date);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (selectedDate === null) {
        void (async () => {
          const nextTimezone = await loadTimezone();
          setTimezone(nextTimezone);
          setSelectedDate(todayInTimezone(nextTimezone));
        })();
        return;
      }

      void loadHistory(selectedDate);
    }, [dataVersion, loadHistory, loadTimezone, selectedDate]),
  );

  const groupedFoods = useMemo(
    () =>
      MEAL_TYPES.map((mealType) => ({
        mealType,
        foods: foods.filter((food) => food.mealType === mealType),
      })).filter((group) => group.foods.length > 0),
    [foods],
  );

  if (selectedDate === null || loading) {
    return (
      <AppScreen>
        <LoadingState message="Loading your history…" />
      </AppScreen>
    );
  }

  const today = todayInTimezone(timezone);
  const isToday = selectedDate === today;

  if (error !== null && loadedDate !== selectedDate) {
    return (
      <AppScreen>
        <ScreenHeader
          title="History"
          subtitle="Food and weight entries by tracking day."
        />
        <ErrorState
          title="History is unavailable"
          message={error}
          onRetry={() => void loadHistory(selectedDate)}
        />
      </AppScreen>
    );
  }

  const openFood = (food: FoodLog) => {
    router.push({
      pathname: '/food-log',
      params: { id: food.id, date: selectedDate },
    });
  };

  return (
    <AppScreen
      refreshing={refreshing}
      onRefresh={() => void loadHistory(selectedDate, true)}
    >
      <ScreenHeader
        title="History"
        subtitle="Food and weight entries by tracking day."
      />

      <AppCard compact className="gap-3">
        <View className="flex-row items-center justify-between gap-2">
          <Pressable
            accessibilityLabel="Previous day"
            accessibilityRole="button"
            className="min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface active:bg-sage-soft"
            onPress={() =>
              setSelectedDate((current) =>
                current === null ? current : addLocalDateDays(current, -1),
              )
            }
          >
            <AppText variant="heading" className="text-sage-dark">
              ‹
            </AppText>
          </Pressable>
          <View className="min-w-0 flex-1 items-center gap-0.5">
            <AppText variant="label" className="text-center">
              {isToday ? 'Today' : selectedDateLabel(selectedDate)}
            </AppText>
            <AppText variant="caption" muted>
              {selectedDate}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Next day"
            accessibilityRole="button"
            className="min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface active:bg-sage-soft"
            onPress={() =>
              setSelectedDate((current) =>
                current === null ? current : addLocalDateDays(current, 1),
              )
            }
          >
            <AppText variant="heading" className="text-sage-dark">
              ›
            </AppText>
          </Pressable>
        </View>
        <AppButton
          variant="ghost"
          disabled={isToday}
          onPress={() => setSelectedDate(today)}
        >
          Return to today
        </AppButton>
      </AppCard>

      {error === null ? null : (
        <ErrorState
          title="Couldn’t refresh history"
          message={error}
          onRetry={() => void loadHistory(selectedDate)}
        />
      )}

      <View className="gap-3">
        <AppText variant="heading">Food</AppText>
        {groupedFoods.length === 0 ? (
          <EmptyState
            title="No food entries this day"
            message="Use the + button to log food for this tracking day."
            symbol="F"
          />
        ) : (
          groupedFoods.map((group) => {
            const calories = group.foods.reduce(
              (total, food) => total + food.calories,
              0,
            );
            const protein = group.foods.reduce(
              (total, food) => total + food.protein,
              0,
            );

            return (
              <View key={group.mealType} className="gap-2">
                <View className="flex-row items-end justify-between gap-3 px-1">
                  <AppText variant="label">{mealLabel(group.mealType)}</AppText>
                  <AppText variant="caption" muted className="tabular-nums">
                    {calories} kcal · {protein.toFixed(1)} g protein
                  </AppText>
                </View>
                <AppCard className="p-0">
                  {group.foods.map((food, index) => (
                    <Pressable
                      key={food.id}
                      accessibilityLabel={`Edit ${food.foodName}`}
                      accessibilityRole="button"
                      className={`flex-row items-center gap-3 px-4 py-3.5 ${
                        index === 0 ? '' : 'border-t border-border'
                      } active:bg-sage-soft/50`}
                      onPress={() => openFood(food)}
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-sage-soft">
                        <AppText variant="label" className="text-sage-dark">
                          {food.foodName.slice(0, 1).toUpperCase()}
                        </AppText>
                      </View>
                      <View className="min-w-0 flex-1 gap-1">
                        <AppText variant="label">{food.foodName}</AppText>
                        <AppText variant="caption" muted>
                          {time(food.loggedAt, timezone)} ·{' '}
                          {food.protein.toFixed(1)} g protein
                        </AppText>
                      </View>
                      <View className="items-end">
                        <AppText variant="label" className="tabular-nums">
                          {food.calories}
                        </AppText>
                        <AppText variant="caption" muted>
                          kcal
                        </AppText>
                      </View>
                    </Pressable>
                  ))}
                </AppCard>
              </View>
            );
          })
        )}
      </View>

      <View className="gap-2.5">
        <AppText variant="heading">Weight</AppText>
        {weights.length === 0 ? (
          <EmptyState
            title="No weight entry this day"
            message="Log a weight when you’re ready to establish a trend."
            symbol="W"
          />
        ) : (
          <AppCard className="p-0">
            {weights.map((weight, index) => (
              <Pressable
                key={weight.id}
                accessibilityLabel={`Edit weight logged ${time(
                  weight.loggedAt,
                  timezone,
                )}`}
                accessibilityRole="button"
                className={`flex-row items-center justify-between px-4 py-3.5 ${
                  index === 0 ? '' : 'border-t border-border'
                } active:bg-sage-soft/50`}
                onPress={() =>
                  router.push({
                    pathname: '/weight-log',
                    params: { id: weight.id },
                  })
                }
              >
                <View className="gap-1">
                  <AppText variant="caption" muted>
                    {time(weight.loggedAt, timezone)}
                  </AppText>
                  <AppText variant="heading" className="tabular-nums">
                    {weight.weightLb.toFixed(1)} lb
                  </AppText>
                </View>
              </Pressable>
            ))}
          </AppCard>
        )}
      </View>
    </AppScreen>
  );
}
