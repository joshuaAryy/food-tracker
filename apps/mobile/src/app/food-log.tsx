import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { MealType } from '@food-tracker/shared';
import { MEAL_TYPES } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FormSection } from '@/components/form-section';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import {
  isValidLocalDate,
  isValidLocalTime,
  localDateTimeFields,
  localDateTimeToIso,
} from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';

interface FoodForm {
  foodName: string;
  mealType: MealType;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
  loggedDate: string;
  loggedTime: string;
}

export default function FoodLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editId = typeof params.id === 'string' ? params.id : null;
  const isEditing = editId !== null;
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [initialTimestamp] = useState(() =>
    localDateTimeFields(new Date().toISOString()),
  );
  const [showMore, setShowMore] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
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
      loggedDate: initialTimestamp.date,
      loggedTime: initialTimestamp.time,
    },
  });

  const loadRecord = useCallback(async () => {
    if (editId === null) {
      return;
    }

    setLoadingRecord(true);
    setLoadError(null);
    try {
      const foodLog = await api.foodLogs.getById(editId);
      const timestamp = localDateTimeFields(foodLog.loggedAt);
      reset({
        foodName: foodLog.foodName,
        mealType: foodLog.mealType,
        calories: String(foodLog.calories),
        protein: String(foodLog.protein),
        carbs: foodLog.carbs === null ? '' : String(foodLog.carbs),
        fat: foodLog.fat === null ? '' : String(foodLog.fat),
        notes: foodLog.notes ?? '',
        loggedDate: timestamp.date,
        loggedTime: timestamp.time,
      });
      setShowMore(
        foodLog.carbs !== null ||
          foodLog.fat !== null ||
          foodLog.notes !== null,
      );
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoadingRecord(false);
    }
  }, [editId, reset]);

  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  const returnToHistory = () => {
    markDataChanged();
    router.replace('/(tabs)/history');
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    const loggedAt = localDateTimeToIso(values.loggedDate, values.loggedTime);

    if (loggedAt === null) {
      setSubmitError('Choose a valid date and time.');
      return;
    }

    const input = {
      foodName: values.foodName.trim(),
      mealType: values.mealType,
      calories: Math.round(Number(values.calories)),
      protein: Number(values.protein),
      loggedAt,
      ...(values.carbs.trim() === '' ? {} : { carbs: Number(values.carbs) }),
      ...(values.fat.trim() === '' ? {} : { fat: Number(values.fat) }),
      ...(values.notes.trim() === '' ? {} : { notes: values.notes.trim() }),
    };

    try {
      if (editId === null) {
        await api.foodLogs.create(input);
      } else {
        await api.foodLogs.update(editId, input);
      }
      returnToHistory();
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  const deleteRecord = async () => {
    if (editId === null) {
      return;
    }

    setDeleting(true);
    setSubmitError(null);
    try {
      await api.foodLogs.delete(editId);
      returnToHistory();
    } catch (error) {
      setSubmitError(errorMessage(error));
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (
        globalThis.confirm(
          'Delete food entry?\n\nThis removes the entry from history and future analytics.',
        )
      ) {
        void deleteRecord();
      }
      return;
    }

    Alert.alert(
      'Delete food entry?',
      'This removes the entry from history and future analytics.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteRecord(),
        },
      ],
    );
  };

  if (loadingRecord) {
    return (
      <AppScreen>
        <LoadingState message="Loading food entry…" />
      </AppScreen>
    );
  }

  if (loadError !== null) {
    return (
      <AppScreen>
        <ScreenHeader
          title="Edit food"
          subtitle="Review and correct this entry."
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
        <ErrorState
          title="Food entry is unavailable"
          message={loadError}
          onRetry={() => void loadRecord()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      contentClassName="gap-4 pb-8"
      footer={
        <View className="gap-2">
          <AppButton
            loading={isSubmitting}
            disabled={deleting}
            onPress={() => void submit()}
          >
            {isEditing ? 'Save changes' : 'Save food'}
          </AppButton>
          {isEditing ? (
            <AppButton
              variant="danger"
              loading={deleting}
              disabled={isSubmitting}
              onPress={confirmDelete}
            >
              Delete food entry
            </AppButton>
          ) : null}
        </View>
      }
    >
      <ScreenHeader
        title={isEditing ? 'Edit food' : 'Log food'}
        subtitle={
          isEditing
            ? 'Review and correct this entry.'
            : 'Add the nutrition values from your meal.'
        }
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
              autoFocus={!isEditing}
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
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
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
          accessibilityState={{ expanded: showMore }}
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

      <FormSection
        title="Date and time"
        description="Enter local time. It will be stored as a UTC timestamp."
      >
        <Controller
          control={control}
          name="loggedDate"
          rules={{
            required: 'Date is required.',
            validate: (value) =>
              isValidLocalDate(value) ? true : 'Use YYYY-MM-DD.',
          }}
          render={({ field }) => (
            <AppInput
              label="Date"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              placeholder="2026-06-22"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.loggedDate?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="loggedTime"
          rules={{
            required: 'Time is required.',
            validate: (value) =>
              isValidLocalTime(value) ? true : 'Use 24-hour HH:mm.',
          }}
          render={({ field }) => (
            <AppInput
              label="Time"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              placeholder="18:30"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.loggedTime?.message}
              hint="24-hour format"
            />
          )}
        />
      </FormSection>
    </AppScreen>
  );
}
