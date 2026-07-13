import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { FoodItem, TrackingMode } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { libraryPresentation } from '@/lib/food-library-ui';
import { useAppStore } from '@/store/app-store';

export default function FoodLibraryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; archived?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const archived = params.archived === 'true';
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [food, setFood] = useState<FoodItem | null>(null);
  const [mode, setMode] = useState<TrackingMode>('simple');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [item, preferences] = await Promise.all([
        api.foodItems.libraryDetail(id),
        api.trackingPreferences.get().catch(() => null),
      ]);
      setFood(item);
      setMode(preferences?.mode ?? 'simple');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading)
    return (
      <AppScreen>
        <LoadingState message="Loading food…" />
      </AppScreen>
    );
  if (food === null)
    return (
      <AppScreen>
        <ErrorState
          title="Food unavailable"
          message={error ?? 'This food is unavailable.'}
          onRetry={() => void load()}
        />
      </AppScreen>
    );
  const presentation = libraryPresentation(food, archived, mode);
  const mutate = async (action: () => Promise<unknown>) => {
    if (saving) return;
    setSaving(true);
    try {
      await action();
      markDataChanged();
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppScreen contentClassName="gap-5">
      <ScreenHeader
        eyebrow={food.sourceProvider ?? 'Trusted food'}
        title={food.name}
        subtitle={
          food.description ??
          `${food.servingQuantity ?? '—'} ${food.servingUnit ?? ''} nutrition basis`
        }
        action={
          <Pressable onPress={() => router.back()}>
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      {error ? (
        <ErrorState
          title="Action unavailable"
          message={error}
          onRetry={() => void load()}
        />
      ) : null}
      <View className="gap-1 rounded-card bg-surface p-4">
        <AppText variant="heading">{presentation.calories ?? '—'} kcal</AppText>
        <AppText variant="caption" muted>
          Protein {presentation.protein ?? '—'} g · Carbs{' '}
          {presentation.carbs ?? '—'} g · Fat {presentation.fat ?? '—'} g
        </AppText>
        {mode === 'complex' ? (
          <AppText variant="caption" muted>
            Fiber {presentation.fiber ?? 'Unknown'} · Sugar{' '}
            {presentation.sugar ?? 'Unknown'}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" muted>
        {food.defaultServing
          ? `Default: ${food.defaultServing.quantity} ${food.defaultServing.unit}`
          : 'No default serving'}
      </AppText>
      {!archived ? (
        <AppButton
          loading={saving}
          onPress={() =>
            void mutate(() =>
              food.isSaved
                ? api.foodItems.unsave(food.id)
                : api.foodItems.save(food.id),
            )
          }
        >
          {food.isSaved ? 'Unsave food' : 'Save food'}
        </AppButton>
      ) : null}
      {!archived ? (
        <AppButton
          onPress={() => router.push(`/food-log/default-serving?id=${food.id}`)}
        >
          Set default serving
        </AppButton>
      ) : null}
      {food.defaultServing && !archived ? (
        <AppButton
          onPress={() =>
            void mutate(() => api.foodItems.removeDefaultServing(food.id))
          }
        >
          Remove default serving
        </AppButton>
      ) : null}
      {presentation.canEdit ? (
        <AppButton
          onPress={() => router.push(`/food-log/manual-food?id=${food.id}`)}
        >
          Edit manual food
        </AppButton>
      ) : null}
      {presentation.canArchive ? (
        <AppButton
          onPress={() =>
            Alert.alert(
              'Archive manual food?',
              'It will be unavailable for future use.',
              [
                { text: 'Cancel' },
                {
                  text: 'Archive',
                  style: 'destructive',
                  onPress: () =>
                    void mutate(() => api.foodItems.archive(food.id)),
                },
              ],
            )
          }
        >
          Archive manual food
        </AppButton>
      ) : null}
      {presentation.canRestore ? (
        <AppButton
          loading={saving}
          onPress={() => void mutate(() => api.foodItems.restore(food.id))}
        >
          Restore manual food
        </AppButton>
      ) : null}
    </AppScreen>
  );
}
