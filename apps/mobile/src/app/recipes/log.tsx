import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MEAL_TYPES, type MealType, type Recipe } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FormSection } from '@/components/form-section';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, ApiClientError, errorMessage } from '@/lib/api-client';
import {
  dateTimeFieldsInTimezone,
  isValidLocalDate,
  isValidLocalTime,
  zonedDateTimeToIso,
} from '@/lib/date-time';
import {
  buildRecipeLogRequest,
  recipeLogUnits,
  refreshAfterRecipeLog,
} from '@/lib/recipe-ui';
import { useAppStore } from '@/store/app-store';

function stableRecipeLogError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'RECIPE_FINAL_WEIGHT_REQUIRED') {
      return 'This recipe needs a final cooked weight before it can be logged by grams.';
    }
    if (error.code === 'NOT_FOUND') {
      return 'This recipe is no longer available. Return to Recipes and refresh the list.';
    }
  }
  return errorMessage(error);
}

export default function RecipeLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const recipeId = typeof params.id === 'string' ? params.id : null;
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [timezone, setTimezone] = useState('America/Toronto');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<'portion' | 'g'>('portion');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (recipeId === null) {
      setError('This recipe link is incomplete.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextRecipe, profile] = await Promise.all([
        api.recipes.getById(recipeId),
        api.profile.get().catch(() => null),
      ]);
      const nextTimezone = profile?.timezone ?? 'America/Toronto';
      const fields = dateTimeFieldsInTimezone(new Date(), nextTimezone);
      setRecipe(nextRecipe);
      setTimezone(nextTimezone);
      setDate(fields.date);
      setTime(fields.time);
      setUnit('portion');
      setAmount('1');
    } catch (loadError) {
      setError(stableRecipeLogError(loadError));
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (recipe === null) return;
    const loggedAt = zonedDateTimeToIso(date, time, timezone);
    if (
      loggedAt === null ||
      !isValidLocalDate(date) ||
      !isValidLocalTime(time)
    ) {
      setError('Choose a valid date and time.');
      return;
    }
    const input = buildRecipeLogRequest(
      { amount, unit, mealType, loggedAt, notes },
      recipe,
    );
    if (input === null) {
      setError(
        unit === 'g'
          ? 'Gram logging needs a final cooked weight and a positive amount.'
          : 'Enter a positive portion amount.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.recipes.log(recipe.id, input);
      refreshAfterRecipeLog(markDataChanged);
      router.replace('/(tabs)/history');
    } catch (saveError) {
      setError(stableRecipeLogError(saveError));
      setSaving(false);
    }
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
  const units = recipeLogUnits(recipe);

  return (
    <AppScreen
      contentClassName="gap-6 pb-8"
      footer={
        <AppButton
          loading={saving}
          disabled={saving}
          onPress={() => void submit()}
        >
          Log recipe
        </AppButton>
      }
    >
      <ScreenHeader
        eyebrow="Recipes"
        title={`Log ${recipe.name}`}
        subtitle="The saved recipe nutrition will be logged exactly as the backend calculates it."
        action={
          <Pressable
            accessibilityLabel="Close recipe logging"
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
        <ErrorState title="Couldn’t log recipe" message={error} />
      )}
      <FormSection
        title="Amount"
        description={
          recipe.finalCookedWeightGrams === null
            ? 'Log a portion of this recipe.'
            : `This recipe has ${recipe.finalCookedWeightGrams} g final cooked weight.`
        }
        variant="open"
      >
        <AppInput
          label={unit === 'portion' ? 'Portions' : 'Grams'}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="1"
          hint={
            unit === 'portion'
              ? `${recipe.portionCount} portions in the full recipe.`
              : 'Gram logging uses the final cooked weight.'
          }
        />
        <View className="flex-row flex-wrap gap-2">
          {units.map((nextUnit) => {
            const selected = nextUnit === unit;
            return (
              <Pressable
                key={nextUnit}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`min-h-10 rounded-full px-4 py-2 ${selected ? 'bg-primary' : 'bg-module'}`}
                onPress={() => setUnit(nextUnit)}
              >
                <AppText
                  variant="label"
                  className={selected ? 'text-white' : 'text-muted'}
                >
                  {nextUnit === 'portion' ? 'Portion' : 'Grams'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </FormSection>
      <FormSection
        title="Meal and time"
        description={`Use the time you ate in ${timezone}.`}
        variant="open"
      >
        <View className="gap-1.5">
          <AppText variant="label">Meal</AppText>
          <View className="flex-row flex-wrap gap-2">
            {MEAL_TYPES.map((meal) => {
              const selected = meal === mealType;
              return (
                <Pressable
                  key={meal}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`min-h-10 rounded-full px-3.5 py-2 ${selected ? 'bg-primary' : 'bg-module'}`}
                  onPress={() => setMealType(meal)}
                >
                  <AppText
                    variant="label"
                    className={selected ? 'text-white' : 'text-muted'}
                  >
                    {meal[0]?.toUpperCase().concat(meal.slice(1))}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <AppInput
          label="Date"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          placeholder="2026-07-12"
          value={date}
          onChangeText={setDate}
        />
        <AppInput
          label="Time"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          placeholder="18:30"
          value={time}
          onChangeText={setTime}
          hint="24-hour format"
        />
        <AppInput
          label="Notes"
          multiline
          numberOfLines={3}
          placeholder="Optional context"
          value={notes}
          onChangeText={setNotes}
        />
      </FormSection>
    </AppScreen>
  );
}
