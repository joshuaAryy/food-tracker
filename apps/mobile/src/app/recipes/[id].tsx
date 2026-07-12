import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Scale } from 'lucide-react-native';
import type { Recipe, TrackingMode } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { RecipeNutritionSummary } from '@/components/recipe-nutrition-summary';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';

export default function RecipeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const recipeId = typeof params.id === 'string' ? params.id : null;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [mode, setMode] = useState<TrackingMode>('simple');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    if (recipeId === null) {
      setError('This recipe link is incomplete.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextRecipe, preferences] = await Promise.all([
        api.recipes.getById(recipeId),
        api.trackingPreferences.get().catch(() => null),
      ]);
      setRecipe(nextRecipe);
      setMode(preferences?.mode ?? 'simple');
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const archive = async () => {
    if (recipe === null) return;
    setArchiving(true);
    try {
      await api.recipes.archive(recipe.id);
      router.replace('/recipes');
    } catch (archiveError) {
      setError(errorMessage(archiveError));
      setArchiving(false);
    }
  };

  const confirmArchive = () => {
    if (recipe === null) return;
    const message = `Archive ${recipe.name}? It will stay on past History entries but can no longer be logged or edited.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void archive();
      return;
    }
    Alert.alert('Archive recipe?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => void archive() },
    ]);
  };

  if (loading)
    return (
      <AppScreen>
        <LoadingState message="Loading recipe…" />
      </AppScreen>
    );
  if (recipe === null)
    return (
      <AppScreen>
        <ErrorState
          title="Recipe is unavailable"
          message={error ?? 'Recipe not found.'}
          onRetry={() => void load()}
        />
      </AppScreen>
    );

  return (
    <AppScreen contentClassName="gap-5 pb-8">
      <ScreenHeader
        eyebrow="Recipes"
        title={recipe.name}
        subtitle={
          recipe.description ??
          'A reusable recipe made from frozen trusted ingredients.'
        }
        action={
          <Pressable
            accessibilityLabel="Close recipe"
            accessibilityRole="button"
            className="rounded-full bg-surface px-3.5 py-2"
            onPress={() => router.back()}
          >
            <AppText variant="label" className="text-primary-dark">
              Close
            </AppText>
          </Pressable>
        }
      />
      {error === null ? null : (
        <ErrorState
          title="Recipe action is unavailable"
          message={error}
          onRetry={() => void load()}
        />
      )}
      <View className="gap-2 rounded-[28px] bg-module p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="gap-0.5">
            <AppText variant="label">Makes</AppText>
            <AppText variant="heading">
              {recipe.portionCount}{' '}
              {recipe.portionCount === 1 ? 'portion' : 'portions'}
            </AppText>
          </View>
          <View className="items-end gap-0.5">
            <AppText variant="caption" muted>
              {recipe.finalCookedWeightGrams === null
                ? 'Gram logging unavailable'
                : 'Gram logging available'}
            </AppText>
            {recipe.finalCookedWeightGrams === null ? null : (
              <AppText variant="label">
                {recipe.finalCookedWeightGrams} g cooked
              </AppText>
            )}
          </View>
        </View>
      </View>
      <View className="gap-3">
        <RecipeNutritionSummary
          title="Whole recipe"
          summary={recipe.total}
          mode={mode}
        />
        <RecipeNutritionSummary
          title="Per portion"
          summary={recipe.perPortion}
          mode={mode}
        />
        {recipe.perGram === null ? null : (
          <RecipeNutritionSummary
            title="Per gram"
            summary={recipe.perGram}
            mode={mode}
          />
        )}
      </View>
      <View className="gap-3">
        <View className="flex-row items-end justify-between">
          <AppText variant="heading">Ingredients</AppText>
          <AppText variant="caption" muted>
            {recipe.ingredients.length}
          </AppText>
        </View>
        <AppCard compact className="gap-0">
          {recipe.ingredients.map((ingredient, index) => (
            <View
              key={ingredient.id}
              className={index === 0 ? 'py-2' : 'border-t border-line py-3'}
            >
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1 gap-0.5">
                  <AppText variant="label" numberOfLines={1}>
                    {ingredient.snapshot.foodItem.name}
                  </AppText>
                  <AppText variant="caption" muted>
                    {ingredient.snapshot.requestedServing.quantity}{' '}
                    {ingredient.snapshot.requestedServing.unit}
                  </AppText>
                </View>
                <ChevronRight size={16} color="#A6A6A1" strokeWidth={2.25} />
              </View>
            </View>
          ))}
        </AppCard>
      </View>
      <View className="gap-2 border-t border-line pt-4">
        <AppButton onPress={() => router.push(`/recipes/log?id=${recipe.id}`)}>
          Log recipe
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.push(`/recipes/editor?id=${recipe.id}`)}
        >
          Edit recipe
        </AppButton>
        <AppButton
          variant="danger"
          loading={archiving}
          disabled={archiving}
          onPress={confirmArchive}
        >
          Archive recipe
        </AppButton>
      </View>
      <View className="flex-row items-start gap-2 rounded-control bg-primary-soft px-3 py-3">
        <Scale size={16} color="#111111" strokeWidth={2.25} />
        <AppText variant="caption" className="flex-1 text-muted">
          Totals are shown from the frozen recipe snapshots, not from live
          FoodItems.
        </AppText>
      </View>
    </AppScreen>
  );
}
