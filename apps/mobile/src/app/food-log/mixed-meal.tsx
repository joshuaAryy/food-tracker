import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  MEAL_TYPES,
  type AiFoodParseCandidate,
  type FoodItem,
  type MealType,
  type TrackingMode,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FoodItemChoiceRow } from '@/components/food-item-choice-row';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { SelectableOption } from '@/components/selectable-option';
import { api, errorMessage } from '@/lib/api-client';
import {
  externalCandidatePersistenceInput,
  applyTrustedFoodCandidate,
  type RecipeEditorIngredientDraft,
} from '@/lib/recipe-ui';
import {
  applyMixedMealServingResult,
  mixedMealCreateRequest,
  mixedMealDisplayTotals,
  mixedMealPreviewRequest,
  type MixedMealDraft,
} from '@/lib/mixed-meal-ui';
import { refreshAfterMixedMeal } from '@/lib/mixed-meal-ui';
import { defaultServingDraft } from '@/lib/food-library-ui';
import { useAppStore } from '@/store/app-store';

function initialDraft(): MixedMealDraft {
  return {
    name: '',
    mealType: 'lunch',
    loggedAt: new Date().toISOString(),
    notes: '',
    ingredients: [],
    saveAsRecipe: false,
    recipeName: '',
    recipeDescription: '',
    portionCount: '1',
    cookedWeight: '',
  };
}

export default function MixedMealScreen() {
  const router = useRouter();
  const draft = useAppStore((state) => state.mixedMealDraft) ?? null;
  const setDraft = useAppStore((state) => state.setMixedMealDraft);
  const clearDraft = useAppStore((state) => state.clearMixedMealDraft);
  const servingResult = useAppStore((state) => state.recipeServingResult);
  const clearServingResult = useAppStore(
    (state) => state.clearRecipeServingResult,
  );
  const beginServing = useAppStore((state) => state.beginRecipeServing);
  const manualResult = useAppStore((state) => state.mixedMealManualResult);
  const clearManualResult = useAppStore(
    (state) => state.clearMixedMealManualResult,
  );
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [mode, setMode] = useState<TrackingMode>('simple');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AiFoodParseCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [persisting, setPersisting] = useState<string | null>(null);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof api.foodLogs.previewMixedMeal>
  > | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingServing, setPendingServing] = useState<{
    key: string;
    index: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const persistingRef = useRef(false);
  const currentDraft = draft ?? initialDraft();
  useEffect(() => {
    if (draft === null) setDraft(currentDraft);
  }, [currentDraft, draft, setDraft]);
  useEffect(() => {
    void api.trackingPreferences
      .get()
      .then((preferences) => setMode(preferences.mode))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (manualResult === null) return;
    const index = currentDraft.ingredients.length;
    const key = `mixed-serving-${Date.now()}`;
    const recipeDraft: RecipeEditorIngredientDraft = {
      key: `mixed-${Date.now()}`,
      foodItemId: manualResult.id,
      ...defaultServingDraft(manualResult),
      servingStatus: 'invalid',
      food: manualResult,
      label: manualResult.name,
    };
    beginServing({
      key,
      context: 'mixedMeal',
      operation: 'add',
      ingredientIndex: index,
      draft: recipeDraft,
    });
    setPendingServing({ key, index });
    clearManualResult();
    router.push('/recipes/ingredient-serving');
  }, [
    beginServing,
    clearManualResult,
    currentDraft.ingredients.length,
    manualResult,
    router,
  ]);
  useEffect(() => {
    if (
      servingResult === null ||
      pendingServing === null ||
      servingResult.key !== pendingServing.key
    )
      return;
    const next = applyMixedMealServingResult(
      currentDraft.ingredients,
      pendingServing.index,
      { operation: servingResult.operation, draft: servingResult.draft },
    );
    setDraft({ ...currentDraft, ingredients: next });
    setPendingServing(null);
    clearServingResult(servingResult.key);
  }, [
    clearServingResult,
    currentDraft,
    pendingServing,
    setDraft,
    servingResult,
  ]);
  useEffect(() => {
    const input = mixedMealPreviewRequest(currentDraft);
    if (input === null) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void api.foodLogs
      .previewMixedMeal(input)
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentDraft]);
  useEffect(() => {
    if (!pickerOpen || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void api.foodItems
        .searchCandidates({ query: query.trim(), limit: 10 })
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch((cause) => {
          if (!cancelled) setError(errorMessage(cause));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickerOpen, query]);
  const openServing = (
    food: FoodItem,
    index: number,
    operation: 'add' | 'edit',
  ) => {
    const prefill = defaultServingDraft(food);
    const key = `mixed-serving-${Date.now()}-${index}`;
    const ingredient: RecipeEditorIngredientDraft = {
      key:
        operation === 'add'
          ? `mixed-${Date.now()}`
          : currentDraft.ingredients[index]!.key,
      foodItemId: food.id,
      amount:
        operation === 'edit'
          ? currentDraft.ingredients[index]!.amount
          : prefill.amount,
      unit:
        operation === 'edit'
          ? currentDraft.ingredients[index]!.unit
          : prefill.unit,
      servingOptionId:
        operation === 'edit'
          ? currentDraft.ingredients[index]!.servingOptionId
          : prefill.servingOptionId,
      servingStatus: 'invalid',
      food,
      label: food.name,
    };
    beginServing({
      key,
      context: 'mixedMeal',
      operation,
      ingredientIndex: index,
      draft: ingredient,
    });
    setPendingServing({ key, index });
    setPickerOpen(false);
    setQuery('');
    Keyboard.dismiss();
    router.push('/recipes/ingredient-serving');
  };
  const selectCandidate = async (candidate: AiFoodParseCandidate) => {
    const persisted = applyTrustedFoodCandidate(candidate);
    if (persisted !== null) {
      openServing(persisted, currentDraft.ingredients.length, 'add');
      return;
    }
    const input = externalCandidatePersistenceInput(candidate);
    if (input === null || persistingRef.current) return;
    persistingRef.current = true;
    setPersisting(`${input.sourceProvider}:${input.sourceId}`);
    try {
      openServing(
        await api.foodItems.persistExternalCandidate(input),
        currentDraft.ingredients.length,
        'add',
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      persistingRef.current = false;
      setPersisting(null);
    }
  };
  const submit = async () => {
    const input = mixedMealCreateRequest(currentDraft);
    if (input === null) {
      setError('Complete the meal and each ingredient before logging.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.foodLogs.createMixedMeal(input);
      refreshAfterMixedMeal(markDataChanged);
      clearDraft();
      router.replace('/(tabs)/history');
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  };
  const totals = mixedMealDisplayTotals(preview, mode);
  return (
    <AppScreen
      keyboardShouldPersistTaps="always"
      contentClassName="gap-5"
      footer={
        <AppButton
          loading={saving}
          disabled={saving}
          onPress={() => void submit()}
        >
          Log mixed meal
        </AppButton>
      }
    >
      <ScreenHeader
        eyebrow="Food Log"
        title="Mixed meal"
        subtitle="Combine trusted and manual ingredients into one historical log."
        action={
          <Pressable onPress={() => router.back()}>
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      {error !== null ? (
        <ErrorState title="Mixed meal needs attention" message={error} />
      ) : null}
      <AppInput
        label="Meal name"
        placeholder="Rice bowl"
        value={currentDraft.name}
        onChangeText={(name) => setDraft({ ...currentDraft, name })}
      />
      <AppInput
        label="Logged at (ISO date/time)"
        value={currentDraft.loggedAt}
        onChangeText={(loggedAt) => setDraft({ ...currentDraft, loggedAt })}
        hint="Use the date and time you ate this meal."
      />
      <View className="gap-2">
        <AppText variant="label">Meal type</AppText>
        <View className="flex-row flex-wrap gap-2">
          {MEAL_TYPES.map((mealType) => (
            <SelectableOption
              key={mealType}
              value={mealType}
              selected={currentDraft.mealType === mealType}
              label={mealType}
              shape="pill"
              onSelect={(value) =>
                setDraft({ ...currentDraft, mealType: value as MealType })
              }
            />
          ))}
        </View>
      </View>
      <AppInput
        label="Notes (optional)"
        value={currentDraft.notes}
        onChangeText={(notes) => setDraft({ ...currentDraft, notes })}
        multiline
      />
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <AppText variant="heading">Ingredients</AppText>
          <Pressable onPress={() => router.push('/food-log/manual-foods')}>
            <AppText variant="caption" className="text-primary-dark">
              Manage manual foods
            </AppText>
          </Pressable>
        </View>
        {currentDraft.ingredients.map((item, index) => (
          <View key={item.key} className="border-b border-line pb-2">
            <FoodItemChoiceRow
              foodItem={item.food}
              mode={mode}
              onPress={() => openServing(item.food, index, 'edit')}
            />
            <View className="flex-row items-center justify-between">
              <AppText variant="caption" muted>
                {item.amount} {item.unit}
              </AppText>
              <Pressable
                onPress={() =>
                  setDraft({
                    ...currentDraft,
                    ingredients: currentDraft.ingredients.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                <AppText variant="caption" className="text-error">
                  Remove
                </AppText>
              </Pressable>
            </View>
          </View>
        ))}
        <AppButton
          variant="secondary"
          onPress={() => {
            setPickerOpen(true);
            setQuery('');
          }}
        >
          Add ingredient
        </AppButton>
      </View>
      {pickerOpen ? (
        <View className="gap-3 rounded-[24px] bg-module p-4">
          <View className="flex-row items-center justify-between">
            <AppText variant="heading">Find ingredient</AppText>
            <Pressable onPress={() => setPickerOpen(false)}>
              <AppText variant="label">Done</AppText>
            </Pressable>
          </View>
          <AppInput
            label="Search trusted foods"
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
            placeholder="Rice"
          />
          {searching ? <LoadingState message="Searching foods…" /> : null}
          {results.map((candidate) => {
            const persisted = applyTrustedFoodCandidate(candidate);
            const external = externalCandidatePersistenceInput(candidate);
            const key =
              external === null
                ? null
                : `${external.sourceProvider}:${external.sourceId}`;
            return persisted !== null ? (
              <FoodItemChoiceRow
                key={persisted.id}
                foodItem={persisted}
                mode={mode}
                onPress={() => selectCandidate(candidate)}
              />
            ) : (
              <Pressable
                key={key ?? candidate.rank}
                disabled={key === null || persisting !== null}
                onPress={() => void selectCandidate(candidate)}
                className="border-b border-line py-3 disabled:opacity-50"
              >
                <AppText variant="label">
                  {candidate.externalFood?.name ?? 'Unavailable food'}
                </AppText>
                <AppText variant="caption" muted>
                  {key === persisting
                    ? 'Saving trusted food…'
                    : key === null
                      ? 'Unavailable'
                      : 'USDA · save and add'}
                </AppText>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push('/food-log/manual-food')}
            className="border-t border-line py-3"
          >
            <AppText variant="label" className="text-primary-dark">
              Create manual food
            </AppText>
          </Pressable>
        </View>
      ) : null}
      <View className="gap-2 rounded-[24px] bg-surface p-4">
        <View className="flex-row items-center justify-between">
          <AppText variant="heading">Authoritative preview</AppText>
          {previewLoading ? (
            <AppText variant="caption" muted>
              Refreshing…
            </AppText>
          ) : null}
        </View>
        {totals === null ? (
          <AppText variant="caption" muted>
            Add a valid ingredient to preview totals.
          </AppText>
        ) : (
          <View className="gap-1">
            <AppText variant="display">{totals.calories} kcal</AppText>
            <AppText variant="caption">
              Protein {totals.protein} g · Carbs {totals.carbs ?? '—'} g · Fat{' '}
              {totals.fat ?? '—'} g
            </AppText>
            {mode === 'complex' ? (
              <AppText variant="caption" muted>
                Fiber {totals.fiber ?? '—'} g · Sodium {totals.sodium ?? '—'} mg
              </AppText>
            ) : null}
          </View>
        )}
      </View>
      <View className="gap-3 rounded-[24px] bg-module p-4">
        <Pressable
          onPress={() =>
            setDraft({
              ...currentDraft,
              saveAsRecipe: !currentDraft.saveAsRecipe,
            })
          }
        >
          <AppText variant="label">
            {currentDraft.saveAsRecipe
              ? '✓ Save as recipe'
              : '＋ Save as recipe'}
          </AppText>
        </Pressable>
        {currentDraft.saveAsRecipe ? (
          <>
            <AppInput
              label="Recipe name"
              value={currentDraft.recipeName || currentDraft.name}
              onChangeText={(recipeName) =>
                setDraft({ ...currentDraft, recipeName })
              }
            />
            <AppInput
              label="Recipe description"
              value={currentDraft.recipeDescription}
              onChangeText={(recipeDescription) =>
                setDraft({ ...currentDraft, recipeDescription })
              }
              multiline
            />
            <AppInput
              label="Portion count"
              keyboardType="number-pad"
              value={currentDraft.portionCount}
              onChangeText={(portionCount) =>
                setDraft({ ...currentDraft, portionCount })
              }
            />
            <AppInput
              label="Cooked weight (g, optional)"
              keyboardType="decimal-pad"
              value={currentDraft.cookedWeight}
              onChangeText={(cookedWeight) =>
                setDraft({ ...currentDraft, cookedWeight })
              }
            />
          </>
        ) : null}
      </View>
    </AppScreen>
  );
}
