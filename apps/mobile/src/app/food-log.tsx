import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'expo-router';
import type { MealType } from '@food-tracker/shared';
import { MEAL_TYPES } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FormSection } from '@/components/form-section';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

interface FoodForm {
  foodName: string;
  mealType: MealType;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
}

export default function FoodLogScreen() {
  const router = useRouter();
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [showMore, setShowMore] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FoodForm>({
    defaultValues: {
      foodName: '',
      mealType: 'breakfast',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      notes: '',
    },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await api.foodLogs.create({
        foodName: values.foodName.trim(),
        mealType: values.mealType,
        calories: Math.round(Number(values.calories)),
        protein: Number(values.protein),
        loggedAt: new Date().toISOString(),
        ...(values.carbs.trim() === '' ? {} : { carbs: Number(values.carbs) }),
        ...(values.fat.trim() === '' ? {} : { fat: Number(values.fat) }),
        ...(values.notes.trim() === '' ? {} : { notes: values.notes.trim() }),
      });
      markDataChanged();
      router.replace('/(tabs)/progress');
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  return (
    <AppScreen
      contentClassName="gap-4 pb-8"
      footer={
        <AppButton loading={isSubmitting} onPress={() => void submit()}>
          Save food
        </AppButton>
      }
    >
      <ScreenHeader
        title="Log food"
        subtitle="Add the nutrition values from your meal."
        action={
          <Pressable
            accessibilityRole="button"
            className="rounded-full bg-surface px-3.5 py-2"
            onPress={() => router.back()}
          >
            <AppText variant="label" className="text-sage-dark">
              Close
            </AppText>
          </Pressable>
        }
      />

      {submitError === null ? null : (
        <ErrorState
          title="Please check your food entry"
          message={submitError}
        />
      )}

      <FormSection title="Food details">
        <Controller
          control={control}
          name="foodName"
          rules={{ required: 'Food name is required.' }}
          render={({ field }) => (
            <AppInput
              label="Food"
              autoFocus
              placeholder="Chicken breast"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.foodName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="mealType"
          render={({ field }) => (
            <View className="gap-1.5">
              <AppText variant="label">Meal</AppText>
              <View className="flex-row flex-wrap gap-2">
                {MEAL_TYPES.map((meal) => {
                  const selected = meal === field.value;
                  return (
                    <Pressable
                      key={meal}
                      className={`min-h-10 items-center justify-center rounded-full border px-3.5 py-2 ${
                        selected
                          ? 'border-sage bg-sage-soft'
                          : 'border-border bg-surface'
                      }`}
                      onPress={() => field.onChange(meal)}
                    >
                      <AppText
                        variant="label"
                        className={selected ? 'text-sage-dark' : 'text-muted'}
                      >
                        {meal[0]?.toUpperCase().concat(meal.slice(1))}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="calories"
          rules={{
            required: 'Calories are required.',
            validate: (value) =>
              Number.isInteger(Number(value)) && Number(value) >= 0
                ? true
                : 'Calories must be a whole number of 0 or higher.',
          }}
          render={({ field }) => (
            <AppInput
              label="Calories"
              keyboardType="number-pad"
              placeholder="280"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.calories?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="protein"
          rules={{
            required: 'Protein is required.',
            validate: (value) =>
              Number(value) >= 0 ? true : 'Protein must be 0 or higher.',
          }}
          render={({ field }) => (
            <AppInput
              label="Protein (g)"
              keyboardType="decimal-pad"
              placeholder="52"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.protein?.message}
            />
          )}
        />

        <Pressable
          accessibilityRole="button"
          className="flex-row items-center justify-between rounded-control bg-surface px-3.5 py-3"
          onPress={() => setShowMore((current) => !current)}
        >
          <View className="gap-0.5">
            <AppText variant="label">
              {showMore ? 'Hide optional details' : 'More details'}
            </AppText>
            <AppText variant="caption" muted>
              Carbs, fat, and notes
            </AppText>
          </View>
          <AppText className="text-sage-dark">{showMore ? '−' : '+'}</AppText>
        </Pressable>

        {showMore ? (
          <View className="gap-4 border-t border-border pt-4">
            <Controller
              control={control}
              name="carbs"
              rules={{
                validate: (value) =>
                  value === '' || Number(value) >= 0
                    ? true
                    : 'Carbs must be 0 or higher.',
              }}
              render={({ field }) => (
                <AppInput
                  label="Carbs (g)"
                  keyboardType="decimal-pad"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.carbs?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="fat"
              rules={{
                validate: (value) =>
                  value === '' || Number(value) >= 0
                    ? true
                    : 'Fat must be 0 or higher.',
              }}
              render={({ field }) => (
                <AppInput
                  label="Fat (g)"
                  keyboardType="decimal-pad"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.fat?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <AppInput
                  label="Notes"
                  multiline
                  numberOfLines={3}
                  placeholder="Optional context"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                />
              )}
            />
          </View>
        ) : null}
      </FormSection>
    </AppScreen>
  );
}
