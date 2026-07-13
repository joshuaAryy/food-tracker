import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import type { FoodItem } from '@food-tracker/shared';

export default function ManualFoodsScreen() {
  const router = useRouter();
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await api.foodItems.list({ limit: 50 });
      setFoods(items.filter((food) => food.sourceProvider === 'manual'));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading)
    return (
      <AppScreen>
        <LoadingState message="Loading manual foods…" />
      </AppScreen>
    );
  if (error !== null)
    return (
      <AppScreen>
        <ErrorState
          title="Manual foods unavailable"
          message={error}
          onRetry={() => void load()}
        />
      </AppScreen>
    );
  return (
    <AppScreen contentClassName="gap-5">
      <ScreenHeader
        eyebrow="Food library"
        title="Manual foods"
        subtitle="Create reusable nutrition you entered yourself."
        action={
          <Pressable onPress={() => router.back()}>
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      <AppButton onPress={() => router.push('/food-log/manual-food')}>
        Create manual food
      </AppButton>
      {foods.length === 0 ? (
        <EmptyState
          title="No manual foods yet"
          message="Create one when trusted search cannot find the food."
        />
      ) : (
        foods.map((food) => (
          <Pressable
            key={food.id}
            className="gap-1 border-b border-line py-3"
            onPress={() => router.push(`/food-log/manual-food?id=${food.id}`)}
          >
            <View className="flex-row items-center justify-between">
              <AppText variant="label">{food.name}</AppText>
              <AppText variant="caption" muted>
                {food.calories ?? 0} kcal
              </AppText>
            </View>
            <AppText variant="caption" muted>
              {food.servingQuantity ?? '—'} {food.servingUnit ?? ''}
              {food.description ? ` · ${food.description}` : ''}
            </AppText>
          </Pressable>
        ))
      )}
    </AppScreen>
  );
}
