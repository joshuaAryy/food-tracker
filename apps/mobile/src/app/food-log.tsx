import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  DEFAULT_TIMEZONE,
  MEAL_TYPES,
  type FoodLog,
  type FoodLogInput,
  type MealType,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FormSection } from '@/components/form-section';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import {
  dateTimeFieldsInTimezone,
  isValidLocalDate,
  isValidLocalTime,
  zonedDateTimeToIso,
} from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';

interface FoodForm {
  foodName: string;
  mealType: MealType;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  sodium: string;
  servingQuantity: string;
  servingUnit: string;
  notes: string;
  loggedDate: string;
  loggedTime: string;
}

function optionalNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function formValuesFromFood(
  foodLog: FoodLog,
  timestamp: { date: string; time: string },
): FoodForm {
  return {
    foodName: foodLog.foodName,
    mealType: foodLog.mealType,
    calories: String(foodLog.calories),
    protein: String(foodLog.protein),
    carbs: optionalNumber(foodLog.carbs),
    fat: optionalNumber(foodLog.fat),
    fiber: optionalNumber(foodLog.fiber),
    sugar: optionalNumber(foodLog.sugar),
    sodium: optionalNumber(foodLog.sodium),
    servingQuantity: optionalNumber(foodLog.servingQuantity),
    servingUnit: foodLog.servingUnit ?? '',
    notes: foodLog.notes ?? '',
    loggedDate: timestamp.date,
    loggedTime: timestamp.time,
  };
}

function hasOptionalDetails(foodLog: FoodLog): boolean {
  return (
    foodLog.carbs !== null ||
    foodLog.fat !== null ||
    foodLog.fiber !== null ||
    foodLog.sugar !== null ||
    foodLog.sodium !== null ||
    foodLog.servingQuantity !== null ||
    foodLog.servingUnit !== null ||
    foodLog.notes !== null
  );
}

function recentFoodKey(foodLog: FoodLog): string {
  return JSON.stringify([
    foodLog.foodName.trim().toLocaleLowerCase(),
    foodLog.mealType,
    foodLog.calories,
    foodLog.protein,
    foodLog.carbs,
    foodLog.fat,
    foodLog.fiber,
    foodLog.sugar,
    foodLog.sodium,
    foodLog.servingQuantity,
    foodLog.servingUnit?.trim().toLocaleLowerCase() ?? null,
  ]);
}

function dedupeRecentFoods(foodLogs: FoodLog[], limit = 6): FoodLog[] {
  const seen = new Set<string>();
  const recent: FoodLog[] = [];

  for (const foodLog of foodLogs) {
    const key = recentFoodKey(foodLog);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    recent.push(foodLog);
    if (recent.length === limit) {
      break;
    }
  }

  return recent;
}

export default function FoodLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    duplicateId?: string | string[];
    date?: string | string[];
  }>();
  const editId = typeof params.id === 'string' ? params.id : null;
  const duplicateId =
    typeof params.duplicateId === 'string' ? params.duplicateId : null;
  const requestedDate = typeof params.date === 'string' ? params.date : null;
  const isEditing = editId !== null;
  const isDuplicating = !isEditing && duplicateId !== null;
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [showMore, setShowMore] = useState(false);
  const [recentFoods, setRecentFoods] = useState<FoodLog[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const {
    control,
    getValues,
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
      fiber: '',
      sugar: '',
      sodium: '',
      servingQuantity: '',
      servingUnit: '',
      notes: '',
      loggedDate: '',
      loggedTime: '',
    },
  });

  const loadForm = useCallback(async () => {
    setLoadingRecord(true);
    setLoadError(null);
    setRecentError(null);
    setDeleting(false);

    const [profileResult, recentResult] = await Promise.allSettled([
      api.profile.get(),
      isEditing ? Promise.resolve([]) : api.foodLogs.list({ limit: 30 }),
    ]);
    const nextTimezone =
      profileResult.status === 'fulfilled'
        ? profileResult.value.timezone
        : DEFAULT_TIMEZONE;
    setTimezone(nextTimezone);

    if (recentResult.status === 'fulfilled') {
      setRecentFoods(dedupeRecentFoods(recentResult.value));
    } else {
      setRecentFoods([]);
      setRecentError(errorMessage(recentResult.reason));
    }

    const now = dateTimeFieldsInTimezone(new Date(), nextTimezone);
    const sourceId = editId ?? duplicateId;

    if (sourceId === null) {
      reset({
        foodName: '',
        mealType: 'breakfast',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        fiber: '',
        sugar: '',
        sodium: '',
        servingQuantity: '',
        servingUnit: '',
        notes: '',
        loggedDate:
          requestedDate !== null && isValidLocalDate(requestedDate)
            ? requestedDate
            : now.date,
        loggedTime: now.time,
      });
      setShowMore(false);
      setLoadingRecord(false);
      return;
    }

    try {
      const foodLog = await api.foodLogs.getById(sourceId);
      const timestamp = isEditing
        ? dateTimeFieldsInTimezone(foodLog.loggedAt, nextTimezone)
        : {
            date:
              requestedDate !== null && isValidLocalDate(requestedDate)
                ? requestedDate
                : now.date,
            time: now.time,
          };
      reset(formValuesFromFood(foodLog, timestamp));
      setShowMore(hasOptionalDetails(foodLog));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoadingRecord(false);
    }
  }, [duplicateId, editId, isEditing, requestedDate, reset]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  const returnToHistory = () => {
    markDataChanged();
    router.replace('/(tabs)/history');
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    const loggedAt = zonedDateTimeToIso(
      values.loggedDate,
      values.loggedTime,
      timezone,
    );

    if (loggedAt === null) {
      setSubmitError('Choose a valid date and time.');
      return;
    }

    const input: FoodLogInput = {
      foodName: values.foodName.trim(),
      mealType: values.mealType,
      calories: Math.round(Number(values.calories)),
      protein: Number(values.protein),
      loggedAt,
      ...(values.carbs.trim() === '' ? {} : { carbs: Number(values.carbs) }),
      ...(values.fat.trim() === '' ? {} : { fat: Number(values.fat) }),
      ...(values.fiber.trim() === '' ? {} : { fiber: Number(values.fiber) }),
      ...(values.sugar.trim() === '' ? {} : { sugar: Number(values.sugar) }),
      ...(values.sodium.trim() === ''
        ? {}
        : { sodium: Math.round(Number(values.sodium)) }),
      ...(values.servingQuantity.trim() === ''
        ? {}
        : { servingQuantity: Number(values.servingQuantity) }),
      ...(values.servingUnit.trim() === ''
        ? {}
        : { servingUnit: values.servingUnit.trim() }),
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

  const applyRecentFood = (foodLog: FoodLog) => {
    const current = getValues();
    reset(
      formValuesFromFood(foodLog, {
        date: current.loggedDate,
        time: current.loggedTime,
      }),
    );
    setShowMore(hasOptionalDetails(foodLog));
    setSubmitError(null);
  };

  const logAgain = () => {
    if (editId === null) {
      return;
    }
    router.replace({
      pathname: '/food-log',
      params: {
        duplicateId: editId,
        ...(requestedDate === null ? {} : { date: requestedDate }),
      },
    });
  };

  if (loadingRecord) {
    return (
      <AppScreen>
        <LoadingState
          message={isEditing ? 'Loading food entry…' : 'Loading food form…'}
        />
      </AppScreen>
    );
  }

  if (loadError !== null) {
    return (
      <AppScreen>
        <ScreenHeader
          title={isEditing ? 'Edit food' : 'Log food again'}
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
          onRetry={() => void loadForm()}
        />
      </AppScreen>
    );
  }

  const title = isEditing
    ? 'Edit food'
    : isDuplicating
      ? 'Log food again'
      : 'Log food';

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
            <>
              <AppButton
                variant="secondary"
                disabled={isSubmitting || deleting}
                onPress={logAgain}
              >
                Log again
              </AppButton>
              <AppButton
                variant="danger"
                loading={deleting}
                disabled={isSubmitting}
                onPress={confirmDelete}
              >
                Delete food entry
              </AppButton>
            </>
          ) : null}
        </View>
      }
    >
      <ScreenHeader
        title={title}
        subtitle={
          isEditing
            ? 'Review and correct this entry.'
            : isDuplicating
              ? 'Review the copied values before saving.'
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

      {!isEditing && recentFoods.length > 0 ? (
        <View className="gap-2.5">
          <View className="gap-0.5">
            <AppText variant="heading">Recent foods</AppText>
            <AppText variant="caption" muted>
              Tap one to prefill the form.
            </AppText>
          </View>
          <AppCard className="p-0">
            {recentFoods.map((foodLog, index) => (
              <Pressable
                key={foodLog.id}
                accessibilityLabel={`Use recent food ${foodLog.foodName}`}
                accessibilityRole="button"
                className={`flex-row items-center justify-between gap-3 px-4 py-3 ${
                  index === 0 ? '' : 'border-t border-border'
                } active:bg-sage-soft/50`}
                onPress={() => applyRecentFood(foodLog)}
              >
                <View className="min-w-0 flex-1 gap-0.5">
                  <AppText variant="label">{foodLog.foodName}</AppText>
                  <AppText variant="caption" muted>
                    {foodLog.mealType} · {foodLog.protein.toFixed(1)} g protein
                  </AppText>
                </View>
                <AppText variant="label" className="tabular-nums">
                  {foodLog.calories} kcal
                </AppText>
              </Pressable>
            ))}
          </AppCard>
        </View>
      ) : null}

      {!isEditing && recentError !== null ? (
        <ErrorState
          title="Recent foods are unavailable"
          message={recentError}
          onRetry={() => void loadForm()}
        />
      ) : null}

      <FormSection title="Food details">
        <Controller
          control={control}
          name="foodName"
          rules={{ required: 'Food name is required.' }}
          render={({ field }) => (
            <AppInput
              label="Food"
              autoFocus={!isEditing && !isDuplicating}
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
              Nutrition, serving, and notes
            </AppText>
          </View>
          <AppText className="text-sage-dark">{showMore ? '−' : '+'}</AppText>
        </Pressable>

        {showMore ? (
          <View className="gap-4 border-t border-border pt-4">
            {(
              [
                ['carbs', 'Carbs (g)', 'Carbs must be 0 or higher.'],
                ['fat', 'Fat (g)', 'Fat must be 0 or higher.'],
                ['fiber', 'Fiber (g)', 'Fiber must be 0 or higher.'],
                ['sugar', 'Sugar (g)', 'Sugar must be 0 or higher.'],
              ] as const
            ).map(([name, label, message]) => (
              <Controller
                key={name}
                control={control}
                name={name}
                rules={{
                  validate: (value) =>
                    value === '' || Number(value) >= 0 ? true : message,
                }}
                render={({ field }) => (
                  <AppInput
                    label={label}
                    keyboardType="decimal-pad"
                    value={field.value}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    error={errors[name]?.message}
                  />
                )}
              />
            ))}
            <Controller
              control={control}
              name="sodium"
              rules={{
                validate: (value) =>
                  value === '' ||
                  (Number.isInteger(Number(value)) && Number(value) >= 0)
                    ? true
                    : 'Sodium must be a whole number of 0 or higher.',
              }}
              render={({ field }) => (
                <AppInput
                  label="Sodium (mg)"
                  keyboardType="number-pad"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.sodium?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="servingQuantity"
              rules={{
                validate: (value) =>
                  value === '' || Number(value) > 0
                    ? true
                    : 'Serving quantity must be greater than 0.',
              }}
              render={({ field }) => (
                <AppInput
                  label="Serving quantity"
                  keyboardType="decimal-pad"
                  placeholder="1"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  error={errors.servingQuantity?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="servingUnit"
              render={({ field }) => (
                <AppInput
                  label="Serving unit"
                  placeholder="bowl"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
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
        description={`Enter local time in ${timezone}. It will be stored as UTC.`}
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
