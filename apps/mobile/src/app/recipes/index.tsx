import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import type { Recipe, TrackingMode } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { recipeListItem } from '@/lib/recipe-ui';

function RecipeRow({
  recipe,
  mode,
  onPress,
}: {
  recipe: Recipe;
  mode: TrackingMode;
  onPress: () => void;
}) {
  const listItem = recipeListItem(recipe);
  const nutrition = recipe.perPortion.materialized;
  const details = [
    `${listItem.portionCount} ${listItem.portionCount === 1 ? 'portion' : 'portions'}`,
    !listItem.gramLoggingAvailable
      ? 'Portion logging'
      : 'Portion + gram logging',
  ];
  const macros = [
    `${nutrition.protein.toFixed(1)} g protein`,
    ...(mode === 'complex'
      ? [
          nutrition.carbs === null
            ? null
            : `${nutrition.carbs.toFixed(1)} g carbs`,
          nutrition.fat === null ? null : `${nutrition.fat.toFixed(1)} g fat`,
        ].filter((value): value is string => value !== null)
      : []),
  ].join(' · ');

  return (
    <Pressable
      accessibilityLabel={`Open recipe ${recipe.name}`}
      accessibilityRole="button"
      className="active:opacity-75"
      onPress={onPress}
    >
      <AppCard compact className="gap-2.5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="heading" numberOfLines={1}>
              {recipe.name}
            </AppText>
            {recipe.description === null ? null : (
              <AppText variant="caption" muted numberOfLines={2}>
                {recipe.description}
              </AppText>
            )}
          </View>
          <ChevronRight size={20} color="#7C7C78" strokeWidth={2.4} />
        </View>
        <View className="flex-row items-end justify-between gap-3 border-t border-line pt-2.5">
          <View className="gap-0.5">
            <AppText variant="caption" muted>
              Per portion
            </AppText>
            <AppText variant="heading" className="tabular-nums">
              {listItem.caloriesPerPortion.toLocaleString()} kcal
            </AppText>
          </View>
          <View className="items-end gap-0.5">
            <AppText variant="caption" muted numberOfLines={2}>
              {details.join(' · ')}
            </AppText>
            <AppText variant="caption" className="text-ink" numberOfLines={2}>
              {macros}
            </AppText>
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

export default function RecipesScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mode, setMode] = useState<TrackingMode>('simple');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [nextRecipes, preferences] = await Promise.all([
        api.recipes.list(),
        api.trackingPreferences.get().catch(() => null),
      ]);
      setRecipes(nextRecipes);
      setMode(preferences?.mode ?? 'simple');
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <AppScreen>
        <LoadingState message="Loading recipes…" />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      contentClassName="gap-5 pb-8"
    >
      <ScreenHeader
        eyebrow="Food log"
        title="Recipes"
        subtitle="Reuse trusted ingredients without rebuilding a meal each time."
        action={
          <Pressable
            accessibilityLabel="Close recipes"
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
          title="Recipes are unavailable"
          message={error}
          onRetry={() => void load()}
        />
      )}
      {recipes.length === 0 ? (
        <View className="gap-4">
          <EmptyState
            title="No recipes yet"
            message="Create a recipe from trusted foods you already use."
            symbol="○"
          />
          <AppButton onPress={() => router.push('/recipes/editor')}>
            Create recipe
          </AppButton>
        </View>
      ) : (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <AppText variant="label">Active recipes</AppText>
            <AppText variant="caption" muted>
              {recipes.length}
            </AppText>
          </View>
          {recipes.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              recipe={recipe}
              mode={mode}
              onPress={() => router.push(`/recipes/${recipe.id}`)}
            />
          ))}
          <AppButton
            variant="secondary"
            onPress={() => router.push('/recipes/editor')}
          >
            Create another recipe
          </AppButton>
        </View>
      )}
      {recipes.length === 0 ? null : (
        <View className="flex-row items-center gap-2 rounded-control bg-primary-soft px-3 py-3">
          <BookOpen size={16} color="#111111" strokeWidth={2.25} />
          <AppText variant="caption" className="flex-1 text-muted">
            Recipe nutrition always comes from the saved frozen ingredients.
          </AppText>
        </View>
      )}
    </AppScreen>
  );
}
