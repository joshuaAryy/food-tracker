import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import type {
  AiFoodParseCandidate,
  FoodItem,
  Recipe,
  TrackingMode,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FoodItemChoiceRow } from '@/components/food-item-choice-row';
import { FormSection } from '@/components/form-section';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import {
  buildRecipeCreateRequest,
  buildRecipeMetadataUpdate,
  changedIngredientMutations,
  applyTrustedFoodCandidate,
  applyRecipePickerSelection,
  applyRecipeServingResult,
  cancelRecipeIngredientEditing,
  externalCandidatePersistenceInput,
  recipeBuilderError,
  recipeRequiresMetadataUpdate,
  recipeServingPreview,
  type RecipeEditorIngredientDraft,
  type RecipeIngredientDraft,
} from '@/lib/recipe-ui';
import { useAppStore } from '@/store/app-store';

type EditorDraft = RecipeEditorIngredientDraft;

function previewStatus(
  draft: EditorDraft,
): RecipeIngredientDraft['servingStatus'] {
  const preview = recipeServingPreview(draft);
  if (preview === null) return draft.servingStatus;
  return preview.status === 'exact' || preview.status === 'converted'
    ? 'ready'
    : preview.status;
}

async function draftsFromRecipe(recipe: Recipe): Promise<EditorDraft[]> {
  const foods = await Promise.all(
    recipe.ingredients.map(async (ingredient) => {
      if (ingredient.foodItemId === null) return null;
      try {
        return await api.foodItems.getById(ingredient.foodItemId);
      } catch {
        return null;
      }
    }),
  );
  return recipe.ingredients.map((ingredient, index) => {
    const food = foods[index] ?? null;
    return {
      key: ingredient.id,
      foodItemId: ingredient.foodItemId,
      amount: ingredient.snapshot.requestedServing.quantity,
      unit: ingredient.snapshot.requestedServing.unit,
      servingOptionId: ingredient.snapshot.requestedServing.servingOptionId,
      // A missing source remains a valid frozen ingredient until replaced.
      servingStatus: 'ready',
      existingIngredientId: ingredient.id,
      food,
      label: ingredient.snapshot.foodItem.name,
    };
  });
}

export default function RecipeEditorScreen() {
  const router = useRouter();
  const beginRecipeServing = useAppStore((state) => state.beginRecipeServing);
  const recipeServingResult = useAppStore((state) => state.recipeServingResult);
  const clearRecipeServingResult = useAppStore(
    (state) => state.clearRecipeServingResult,
  );
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const recipeId = typeof params.id === 'string' ? params.id : null;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('simple');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [portionCount, setPortionCount] = useState('1');
  const [cookedWeight, setCookedWeight] = useState('');
  const [drafts, setDrafts] = useState<EditorDraft[]>([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AiFoodParseCandidate[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(recipeId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [persistingCandidateKey, setPersistingCandidateKey] = useState<
    string | null
  >(null);
  const [editingDraftSnapshot, setEditingDraftSnapshot] =
    useState<EditorDraft | null>(null);
  const [pendingServing, setPendingServing] = useState<{
    key: string;
    ingredientIndex: number;
  } | null>(null);
  const persistingCandidateKeyRef = useRef<string | null>(null);

  const values = useMemo(
    () => ({ name, description, portionCount, cookedWeight }),
    [cookedWeight, description, name, portionCount],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const preferences = await api.trackingPreferences.get().catch(() => null);
      setTrackingMode(preferences?.mode ?? 'simple');
      if (recipeId === null) return;
      const loaded = await api.recipes.getById(recipeId);
      setRecipe(loaded);
      setName(loaded.name);
      setDescription(loaded.description ?? '');
      setPortionCount(String(loaded.portionCount));
      setCookedWeight(
        loaded.finalCookedWeightGrams === null
          ? ''
          : String(loaded.finalCookedWeightGrams),
      );
      setDrafts(await draftsFromRecipe(loaded));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      pendingServing === null ||
      recipeServingResult === null ||
      recipeServingResult.key !== pendingServing.key
    ) {
      return;
    }
    setDrafts((current) =>
      applyRecipeServingResult(current, pendingServing.ingredientIndex, {
        operation: recipeServingResult.operation,
        draft: recipeServingResult.draft,
      }),
    );
    setPendingServing(null);
    setEditingDraftSnapshot(null);
    setActiveDraftIndex(null);
    clearRecipeServingResult(pendingServing.key);
  }, [clearRecipeServingResult, pendingServing, recipeServingResult]);

  useEffect(() => {
    if (activeDraftIndex === null || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(() => {
      void api.foodItems
        .searchCandidates({ query: searchQuery.trim(), limit: 10 })
        .then((results) => {
          if (!cancelled) setSearchResults(results);
        })
        .catch((error) => {
          if (!cancelled) setSubmitError(errorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [activeDraftIndex, searchQuery]);

  const activeDraft =
    activeDraftIndex === null ? null : (drafts[activeDraftIndex] ?? null);

  const beginAddingIngredient = () => {
    const newDraft: EditorDraft = {
      key: `new-${Date.now()}`,
      foodItemId: null,
      amount: '',
      unit: '',
      servingOptionId: null,
      servingStatus: 'invalid',
      food: null,
      label: 'Choose a trusted food',
    };
    setDrafts((current) => [...current, newDraft]);
    setActiveDraftIndex(drafts.length);
    setEditingDraftSnapshot(newDraft);
    setSearchQuery('');
  };

  const openServingDetails = (index: number, draft: EditorDraft) => {
    if (draft.food === null) return;
    const key = `recipe-serving-${Date.now()}-${index}`;
    beginRecipeServing({
      key,
      operation: draft.existingIngredientId === undefined ? 'add' : 'edit',
      ingredientIndex: index,
      draft,
    });
    setPendingServing({ key, ingredientIndex: index });
    router.push('/recipes/ingredient-serving');
  };

  const openIngredientEditor = (index: number) => {
    const draft = drafts[index];
    if (draft === undefined) return;
    if (draft.food === null) {
      setActiveDraftIndex(index);
      setEditingDraftSnapshot(draft);
      setSearchQuery('');
      return;
    }
    openServingDetails(index, draft);
  };

  const cancelIngredientEditing = () => {
    if (activeDraftIndex !== null) {
      setDrafts((current) =>
        cancelRecipeIngredientEditing(
          current,
          activeDraftIndex,
          editingDraftSnapshot,
        ),
      );
    }
    setActiveDraftIndex(null);
    setEditingDraftSnapshot(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeIngredient = (index: number) => {
    if (drafts.length <= 1) {
      setSubmitError('A recipe needs at least one ingredient.');
      return;
    }
    setDrafts((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setActiveDraftIndex((current) =>
      current === null
        ? null
        : current === index
          ? null
          : current > index
            ? current - 1
            : current,
    );
  };

  const chooseFood = (food: FoodItem) => {
    const selection = applyRecipePickerSelection(
      drafts,
      activeDraftIndex,
      food,
    );
    if (selection === null) return;
    Keyboard.dismiss();
    const selectedDraft = selection.drafts[activeDraftIndex!];
    if (selectedDraft === undefined) return;
    openServingDetails(activeDraftIndex!, {
      ...selectedDraft,
      servingStatus: previewStatus(selectedDraft),
    });
    setActiveDraftIndex(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const selectCandidate = async (candidate: AiFoodParseCandidate) => {
    const persisted = applyTrustedFoodCandidate(candidate);
    if (persisted !== null) {
      chooseFood(persisted);
      return;
    }
    const input = externalCandidatePersistenceInput(candidate);
    if (input === null || persistingCandidateKeyRef.current !== null) return;
    const candidateKey = `${input.sourceProvider}:${input.sourceId}`;
    persistingCandidateKeyRef.current = candidateKey;
    setPersistingCandidateKey(candidateKey);
    setSubmitError(null);
    try {
      chooseFood(await api.foodItems.persistExternalCandidate(input));
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      persistingCandidateKeyRef.current = null;
      setPersistingCandidateKey(null);
    }
  };

  const save = async () => {
    const helperDrafts = drafts.map((draft) => ({
      key: draft.key,
      foodItemId: draft.foodItemId,
      amount: draft.amount,
      unit: draft.unit,
      servingOptionId: draft.servingOptionId,
      servingStatus: draft.servingStatus,
      ...(draft.existingIngredientId === undefined
        ? {}
        : { existingIngredientId: draft.existingIngredientId }),
    }));
    const validation = recipeBuilderError({
      name,
      portionCount,
      cookedWeight,
      ingredients: helperDrafts,
    });
    if (validation !== null) {
      setSubmitError(validation);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      if (recipe === null) {
        const create = buildRecipeCreateRequest({
          ...values,
          ingredients: helperDrafts,
        });
        if (create === null)
          throw new Error('Correct this recipe before saving.');
        const created = await api.recipes.create(create);
        router.replace(`/recipes/${created.id}`);
        return;
      }

      let updated = recipe;
      if (recipeRequiresMetadataUpdate(recipe, values)) {
        const metadata = buildRecipeMetadataUpdate(values);
        if (metadata === null)
          throw new Error('Correct the recipe details before saving.');
        updated = await api.recipes.update(recipe.id, metadata);
      }
      const changes = changedIngredientMutations(recipe, helperDrafts);
      if (changes.remove.length >= recipe.ingredients.length) {
        throw new Error('A recipe needs at least one ingredient.');
      }
      for (const input of changes.update) {
        const { ingredientId, ...ingredient } = input;
        updated = await api.recipes.updateIngredient(
          recipe.id,
          ingredientId,
          ingredient,
        );
      }
      for (const ingredient of changes.add) {
        updated = await api.recipes.addIngredient(recipe.id, ingredient);
      }
      for (const ingredientId of changes.remove) {
        updated = await api.recipes.deleteIngredient(recipe.id, ingredientId);
      }
      router.replace(`/recipes/${updated.id}`);
    } catch (error) {
      setSubmitError(errorMessage(error));
      setSaving(false);
    }
  };

  if (loading)
    return (
      <AppScreen>
        <LoadingState message="Loading recipe…" />
      </AppScreen>
    );
  if (loadError !== null)
    return (
      <AppScreen>
        <ErrorState
          title="Recipe is unavailable"
          message={loadError}
          onRetry={() => void load()}
        />
      </AppScreen>
    );

  return (
    <AppScreen
      keyboardShouldPersistTaps="always"
      contentClassName="gap-6 pb-8"
      footer={
        <AppButton
          loading={saving}
          disabled={saving}
          onPress={() => void save()}
        >
          {recipe === null ? 'Create recipe' : 'Save recipe changes'}
        </AppButton>
      }
    >
      <ScreenHeader
        eyebrow="Recipes"
        title={recipe === null ? 'Create recipe' : 'Edit recipe'}
        subtitle="Use trusted foods and their saved serving relationships."
        action={
          <Pressable
            accessibilityLabel="Close recipe editor"
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
      {submitError === null ? null : (
        <ErrorState title="Check this recipe" message={submitError} />
      )}
      <FormSection title="Recipe details" variant="open">
        <AppInput
          label="Name"
          autoFocus={recipe === null}
          placeholder="Weeknight chili"
          value={name}
          onChangeText={setName}
        />
        <AppInput
          label="Description"
          multiline
          numberOfLines={3}
          placeholder="Optional notes"
          value={description}
          onChangeText={setDescription}
        />
        <AppInput
          label="Portion count"
          keyboardType="number-pad"
          placeholder="4"
          value={portionCount}
          onChangeText={setPortionCount}
          hint="Whole servings this recipe makes."
        />
        <AppInput
          label="Final cooked weight (g)"
          keyboardType="decimal-pad"
          placeholder="Optional"
          value={cookedWeight}
          onChangeText={setCookedWeight}
          hint="Add this to enable gram logging."
        />
      </FormSection>
      <FormSection
        title="Ingredients"
        description="Only trusted reusable foods can be recipe ingredients."
        variant="open"
      >
        <View className="gap-2 border-y border-line">
          {drafts.map((draft, index) => (
            <View
              key={draft.key}
              className={index === 0 ? '' : 'border-t border-line'}
            >
              {draft.food === null ? (
                <Pressable
                  accessibilityRole="button"
                  className="flex-row items-center justify-between py-3.5 active:bg-module-muted"
                  onPress={() => {
                    openIngredientEditor(index);
                  }}
                >
                  <View className="gap-0.5">
                    <AppText variant="label">{draft.label}</AppText>
                    <AppText variant="caption" className="text-error">
                      Choose a trusted food before saving.
                    </AppText>
                  </View>
                  <X size={18} color="#A45E54" strokeWidth={2.4} />
                </Pressable>
              ) : (
                <View className="gap-1">
                  <FoodItemChoiceRow
                    foodItem={draft.food}
                    mode={trackingMode}
                    selected={activeDraftIndex === index}
                    onPress={() => {
                      openIngredientEditor(index);
                    }}
                  />
                  <View className="flex-row items-center justify-between pb-3">
                    <Pressable
                      accessibilityLabel={`Edit amount for ${draft.label}`}
                      accessibilityRole="button"
                      className="gap-0.5 rounded-control px-2 py-1 active:bg-primary-soft"
                      onPress={() => {
                        openIngredientEditor(index);
                      }}
                    >
                      <AppText variant="caption" muted>
                        {draft.amount} {draft.unit}
                      </AppText>
                      <AppText variant="caption" className="text-primary-dark">
                        Edit amount
                      </AppText>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Remove ${draft.label}`}
                      accessibilityRole="button"
                      disabled={drafts.length <= 1}
                      className="rounded-full bg-error-soft px-3 py-1.5 disabled:opacity-40"
                      onPress={() => removeIngredient(index)}
                    >
                      <AppText variant="caption" className="text-error">
                        Remove
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
        <AppButton variant="secondary" onPress={beginAddingIngredient}>
          Add trusted ingredient
        </AppButton>
      </FormSection>
      {activeDraft === null ? null : (
        <View className="gap-4 rounded-[28px] bg-module p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="gap-0.5">
              <AppText variant="heading">
                {activeDraft.food === null
                  ? 'Find a trusted food'
                  : `Edit ${activeDraft.label}`}
              </AppText>
              <AppText variant="caption" muted>
                {activeDraft.food === null
                  ? 'Search saved, local, or USDA-backed FoodItems.'
                  : 'Change the saved ingredient amount or serving.'}
              </AppText>
            </View>
            <Pressable
              accessibilityLabel="Finish ingredient editing"
              accessibilityRole="button"
              className="rounded-full bg-[#F4F4F4] px-3 py-2"
              onPress={() => {
                cancelIngredientEditing();
              }}
            >
              <AppText variant="caption">Done</AppText>
            </Pressable>
          </View>
          <AppInput
            label="Search trusted foods"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Oats"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searching ? (
            <AppText variant="caption" muted>
              Searching foods…
            </AppText>
          ) : null}
          {searchResults.length > 0 ? (
            <View className="border-y border-line">
              {searchResults.map((candidate, index) => {
                const trustedFood = applyTrustedFoodCandidate(candidate);
                const externalInput =
                  externalCandidatePersistenceInput(candidate);
                const candidateKey =
                  externalInput === null
                    ? null
                    : `${externalInput.sourceProvider}:${externalInput.sourceId}`;
                const persisting = candidateKey === persistingCandidateKey;
                return (
                  <View
                    key={
                      candidate.candidateType === 'food_item'
                        ? candidate.foodItem.id
                        : `${candidate.externalFood.sourceProvider}:${candidate.externalFood.sourceId}`
                    }
                    className={index === 0 ? '' : 'border-t border-line'}
                  >
                    {trustedFood === null ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled:
                            externalInput === null ||
                            persistingCandidateKey !== null,
                        }}
                        disabled={
                          externalInput === null ||
                          persistingCandidateKey !== null
                        }
                        className="flex-row items-center justify-between gap-3 px-3 py-3.5 active:bg-[#F6F6F6] disabled:opacity-50"
                        onPress={() => void selectCandidate(candidate)}
                      >
                        <View className="min-w-0 flex-1 gap-0.5">
                          <AppText variant="label" numberOfLines={1}>
                            {candidate.candidateType === 'external_food'
                              ? candidate.externalFood.name
                              : 'Trusted food unavailable'}
                          </AppText>
                          <AppText variant="caption" muted>
                            {externalInput === null
                              ? 'This candidate cannot be saved as a trusted food.'
                              : persisting
                                ? 'Saving trusted food…'
                                : 'USDA food · save and add to recipe'}
                          </AppText>
                        </View>
                        <AppText
                          variant="caption"
                          className="text-primary-dark"
                        >
                          {persisting ? 'Saving…' : 'Add'}
                        </AppText>
                      </Pressable>
                    ) : (
                      <FoodItemChoiceRow
                        foodItem={trustedFood}
                        mode={trackingMode}
                        disabled={persistingCandidateKey !== null}
                        onPress={() => void selectCandidate(candidate)}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      )}
    </AppScreen>
  );
}
