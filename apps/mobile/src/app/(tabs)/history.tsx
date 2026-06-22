import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { FoodLog, WeightLog } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function HistoryScreen() {
  const router = useRouter();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [nextFoods, nextWeights] = await Promise.all([
        api.foodLogs.list(),
        api.weightLogs.list(),
      ]);
      setFoods(nextFoods);
      setWeights(nextWeights);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [dataVersion, loadHistory]),
  );

  if (loading) {
    return (
      <AppScreen>
        <LoadingState message="Loading your history…" />
      </AppScreen>
    );
  }

  if (error !== null && foods.length === 0 && weights.length === 0) {
    return (
      <AppScreen>
        <ScreenHeader
          title="History"
          subtitle="Your recent food and weight entries."
        />
        <ErrorState
          title="History is unavailable"
          message={error}
          onRetry={() => void loadHistory()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen refreshing={refreshing} onRefresh={() => void loadHistory(true)}>
      <ScreenHeader
        title="History"
        subtitle="Your recent food and weight entries."
      />

      {error === null ? null : (
        <ErrorState
          title="Couldn’t refresh history"
          message={error}
          onRetry={() => void loadHistory()}
        />
      )}

      <View className="gap-2.5">
        <AppText variant="heading">Recent foods</AppText>
        {foods.length === 0 ? (
          <EmptyState
            title="No food entries yet"
            message="Use the + button to add your first meal."
            symbol="F"
          />
        ) : (
          <AppCard className="p-0">
            {foods.slice(0, 12).map((food, index) => (
              <Pressable
                key={food.id}
                accessibilityLabel={`Edit ${food.foodName}`}
                accessibilityRole="button"
                className={`flex-row items-center gap-3 px-4 py-3.5 ${
                  index === 0 ? '' : 'border-t border-border'
                } active:bg-sage-soft/50`}
                onPress={() =>
                  router.push({
                    pathname: '/food-log',
                    params: { id: food.id },
                  })
                }
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-sage-soft">
                  <AppText variant="label" className="text-sage-dark">
                    {food.foodName.slice(0, 1).toUpperCase()}
                  </AppText>
                </View>
                <View className="flex-1 gap-1">
                  <AppText variant="label">{food.foodName}</AppText>
                  <AppText variant="caption" muted>
                    {food.mealType} · {dateTime(food.loggedAt)}
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
        )}
      </View>

      <View className="gap-2.5">
        <AppText variant="heading">Recent weights</AppText>
        {weights.length === 0 ? (
          <EmptyState
            title="No weight entries yet"
            message="Log a weight when you’re ready to establish a trend."
            symbol="W"
          />
        ) : (
          <AppCard className="p-0">
            {weights.slice(0, 8).map((weight, index) => (
              <Pressable
                key={weight.id}
                accessibilityLabel={`Edit weight logged ${dateTime(
                  weight.loggedAt,
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
                    {dateTime(weight.loggedAt)}
                  </AppText>
                  <AppText variant="heading" className="tabular-nums">
                    {weight.weightLb.toFixed(1)} lb
                  </AppText>
                </View>
                {index === 0 ? (
                  <View className="rounded-full bg-sage-soft px-3 py-1">
                    <AppText variant="caption" className="text-sage-dark">
                      Latest
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </AppCard>
        )}
      </View>
    </AppScreen>
  );
}
