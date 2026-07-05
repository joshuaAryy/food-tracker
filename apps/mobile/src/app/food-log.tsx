import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Camera } from 'lucide-react-native';
import {
  DEFAULT_TIMEZONE,
  MEAL_TYPES,
  type FoodItem,
  type FoodItemInput,
  type FoodLog,
  type FoodLogFromFoodItemInput,
  type FoodLogInput,
  type MealType,
  type TrackingMode,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FoodItemChoiceRow } from '@/components/food-item-choice-row';
import { FormSection } from '@/components/form-section';
import { ScreenHeader } from '@/components/screen-header';
import { ServingMultiplierControl } from '@/components/serving-multiplier-control';
import {
  SkeletonLine,
  SkeletonPill,
  SkeletonRail,
} from '@/components/skeleton';
import { api, errorMessage } from '@/lib/api-client';
import {
  dateTimeFieldsInTimezone,
  isValidLocalDate,
  isValidLocalTime,
  zonedDateTimeToIso,
} from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

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

function nullableNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

function nullableInteger(value: string): number | null {
  return value.trim() === '' ? null : Math.round(Number(value));
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

function formValuesFromFoodItem(
  foodItem: FoodItem,
  current: FoodForm,
): FoodForm {
  return {
    ...current,
    foodName: foodItem.name,
    calories: optionalNumber(foodItem.calories),
    protein: optionalNumber(foodItem.protein),
    carbs: optionalNumber(foodItem.carbs),
    fat: optionalNumber(foodItem.fat),
    fiber: optionalNumber(foodItem.fiber),
    sugar: optionalNumber(foodItem.sugar),
    sodium: optionalNumber(foodItem.sodium),
    servingQuantity: optionalNumber(foodItem.servingQuantity),
    servingUnit: foodItem.servingUnit ?? '',
  };
}

function hasFoodItemOptionalDetails(foodItem: FoodItem): boolean {
  return (
    foodItem.carbs !== null ||
    foodItem.fat !== null ||
    foodItem.fiber !== null ||
    foodItem.sugar !== null ||
    foodItem.sodium !== null ||
    foodItem.servingQuantity !== null ||
    foodItem.servingUnit !== null ||
    Object.keys(foodItem.nutrients).length > 0
  );
}

function inferMultiplier(foodLog: FoodLog, foodItem: FoodItem): string {
  if (
    foodLog.servingQuantity === null ||
    foodItem.servingQuantity === null ||
    foodItem.servingQuantity <= 0 ||
    foodLog.servingUnit !== foodItem.servingUnit
  ) {
    return '1';
  }

  return String(
    Math.max(0.25, foodLog.servingQuantity / foodItem.servingQuantity),
  );
}

function FoodLogSkeleton({
  title,
  subtitle,
  footerRows,
}: {
  title: string;
  subtitle: string;
  footerRows: number;
}) {
  return (
    <AppScreen
      contentClassName="gap-6 pb-8"
      footer={
        <View className="gap-2">
          {Array.from({ length: footerRows }, (_, index) => (
            <SkeletonRail key={index} height={52} />
          ))}
        </View>
      }
    >
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        action={<SkeletonPill width={68} height={36} />}
      />

      <View className="gap-4">
        <View className="gap-2">
          <SkeletonLine width={104} height={22} />
          <SkeletonLine width="78%" height={11} />
        </View>
        <View className="gap-4">
          <SkeletonRail height={58} radius={14} />
          <View className="flex-row flex-wrap gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonPill key={index} width={86} height={40} />
            ))}
          </View>
          <SkeletonRail height={58} radius={14} />
          <SkeletonRail height={58} radius={14} />
          <SkeletonRail height={62} radius={24} />
        </View>
      </View>

      <View className="gap-4">
        <View className="gap-2">
          <SkeletonLine width={112} height={22} />
          <SkeletonLine width="64%" height={11} />
        </View>
        <SkeletonRail height={58} radius={14} />
        <SkeletonRail height={58} radius={14} />
      </View>
    </AppScreen>
  );
}

export default function FoodLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    duplicateId?: string | string[];
    date?: string | string[];
    scannedFoodItemId?: string | string[];
  }>();
  const editId = typeof params.id === 'string' ? params.id : null;
  const duplicateId =
    typeof params.duplicateId === 'string' ? params.duplicateId : null;
  const requestedDate = typeof params.date === 'string' ? params.date : null;
  const scannedFoodItemId =
    typeof params.scannedFoodItemId === 'string'
      ? params.scannedFoodItemId
      : null;
  const isEditing = editId !== null;
  const isDuplicating = !isEditing && duplicateId !== null;
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [initialTimestamp] = useState(() =>
    dateTimeFieldsInTimezone(new Date(), DEFAULT_TIMEZONE),
  );
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('simple');
  const [showMore, setShowMore] = useState(false);
  const [recentFoods, setRecentFoods] = useState<FoodLog[]>([]);
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>([]);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [searchedFoodQuery, setSearchedFoodQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingMultiplier, setServingMultiplier] = useState('1');
  const [saveAsReusableFood, setSaveAsReusableFood] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [savedFoodsError, setSavedFoodsError] = useState<string | null>(null);
  const [foodSearchError, setFoodSearchError] = useState<string | null>(null);
  const [savedFoodsLoaded, setSavedFoodsLoaded] = useState(false);
  const [searchingFoods, setSearchingFoods] = useState(false);
  const [loadingScannedFood, setLoadingScannedFood] = useState(false);
  const [scannedFoodError, setScannedFoodError] = useState<string | null>(null);
  const [savingFoodItemId, setSavingFoodItemId] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(
    isEditing || isDuplicating,
  );
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
      loggedDate:
        requestedDate !== null && isValidLocalDate(requestedDate)
          ? requestedDate
          : initialTimestamp.date,
      loggedTime: initialTimestamp.time,
    },
  });

  const loadForm = useCallback(async () => {
    const sourceId = editId ?? duplicateId;
    if (sourceId !== null) {
      setLoadingRecord(true);
    }
    setLoadError(null);
    setRecentError(null);
    setSavedFoodsError(null);
    setFoodSearchError(null);
    setSavedFoodsLoaded(false);
    setDeleting(false);

    const [profileResult, preferencesResult, recentResult, savedResult] =
      await Promise.allSettled([
        api.profile.get(),
        api.trackingPreferences.get(),
        isEditing ? Promise.resolve([]) : api.foodLogs.list({ limit: 30 }),
        isEditing
          ? Promise.resolve([])
          : api.foodItems.list({ savedOnly: true, limit: 10 }),
      ]);
    const nextTimezone =
      profileResult.status === 'fulfilled'
        ? profileResult.value.timezone
        : DEFAULT_TIMEZONE;
    const nextTrackingMode =
      preferencesResult.status === 'fulfilled'
        ? preferencesResult.value.mode
        : 'simple';
    setTimezone(nextTimezone);
    setTrackingMode(nextTrackingMode);

    if (recentResult.status === 'fulfilled') {
      setRecentFoods(dedupeRecentFoods(recentResult.value));
    } else {
      setRecentFoods([]);
      setRecentError(errorMessage(recentResult.reason));
    }

    if (savedResult.status === 'fulfilled') {
      setSavedFoods(savedResult.value);
    } else {
      setSavedFoods([]);
      setSavedFoodsError(errorMessage(savedResult.reason));
    }
    setSavedFoodsLoaded(true);

    const now = dateTimeFieldsInTimezone(new Date(), nextTimezone);

    if (sourceId === null) {
      setShowMore(nextTrackingMode === 'complex');
      if (scannedFoodItemId === null) {
        setSelectedFood(null);
      }
      setServingMultiplier('1');
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
      setShowMore(
        nextTrackingMode === 'complex' || hasOptionalDetails(foodLog),
      );
      setSelectedFood(null);
      setServingMultiplier('1');
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoadingRecord(false);
    }
  }, [duplicateId, editId, isEditing, requestedDate, reset, scannedFoodItemId]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  useEffect(() => {
    if (isEditing || foodSearchQuery.trim().length < 2) {
      setFoodSearchResults([]);
      setFoodSearchError(null);
      setSearchedFoodQuery('');
      setSearchingFoods(false);
      return;
    }

    let cancelled = false;
    const query = foodSearchQuery.trim();
    setSearchingFoods(true);
    setFoodSearchError(null);
    setSearchedFoodQuery('');

    const timeout = setTimeout(() => {
      void api.foodItems
        .list({ query, limit: 10 })
        .then((foodItems) => {
          if (!cancelled) {
            setFoodSearchResults(foodItems);
            setSearchedFoodQuery(query);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setFoodSearchResults([]);
            setFoodSearchError(errorMessage(error));
            setSearchedFoodQuery(query);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchingFoods(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [foodSearchQuery, isEditing]);

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

    const manualInput: FoodLogInput = {
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
        if (selectedFood !== null) {
          const multiplier = Number(servingMultiplier);
          if (!Number.isFinite(multiplier) || multiplier <= 0) {
            setSubmitError('Amount must be greater than 0.');
            return;
          }

          const input: FoodLogFromFoodItemInput = {
            foodItemId: selectedFood.id,
            mealType: values.mealType,
            loggedAt,
            servingMultiplier: multiplier,
            ...(values.notes.trim() === ''
              ? {}
              : { notes: values.notes.trim() }),
          };
          await api.foodLogs.createFromFoodItem(input);
        } else if (saveAsReusableFood) {
          const foodItemInput: FoodItemInput = {
            name: values.foodName.trim(),
            foodType: 'generic',
            servingQuantity: nullableNumber(values.servingQuantity),
            servingUnit:
              values.servingUnit.trim() === ''
                ? null
                : values.servingUnit.trim(),
            calories: Math.round(Number(values.calories)),
            protein: Number(values.protein),
            carbs: nullableNumber(values.carbs),
            fat: nullableNumber(values.fat),
            fiber: nullableNumber(values.fiber),
            sugar: nullableNumber(values.sugar),
            sodium: nullableInteger(values.sodium),
          };
          const foodItem = await api.foodItems.create(foodItemInput);
          await api.foodLogs.createFromFoodItem({
            foodItemId: foodItem.id,
            mealType: values.mealType,
            loggedAt,
            servingMultiplier: 1,
            ...(values.notes.trim() === ''
              ? {}
              : { notes: values.notes.trim() }),
          });
        } else {
          await api.foodLogs.create(manualInput);
        }
      } else {
        await api.foodLogs.update(editId, manualInput);
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

  const updateFoodItemInLists = (foodItem: FoodItem) => {
    setSavedFoods((current) => {
      const withoutFood = current.filter((item) => item.id !== foodItem.id);
      return foodItem.isSaved ? [foodItem, ...withoutFood] : withoutFood;
    });
    setFoodSearchResults((current) =>
      current.map((item) => (item.id === foodItem.id ? foodItem : item)),
    );
    setSelectedFood((current) =>
      current?.id === foodItem.id ? foodItem : current,
    );
  };

  const selectFoodItem = (foodItem: FoodItem, multiplier = '1') => {
    const current = getValues();
    reset(formValuesFromFoodItem(foodItem, current));
    setSelectedFood(foodItem);
    setServingMultiplier(multiplier);
    setSaveAsReusableFood(false);
    setShowMore(
      trackingMode === 'complex' || hasFoodItemOptionalDetails(foodItem),
    );
    setSubmitError(null);
  };

  const clearSelectedFood = () => {
    setSelectedFood(null);
    setServingMultiplier('1');
    setScannedFoodError(null);
    setSubmitError(null);
  };

  const toggleSavedFood = async (foodItem: FoodItem) => {
    setSavingFoodItemId(foodItem.id);
    setSubmitError(null);
    try {
      if (foodItem.isSaved) {
        await api.foodItems.unsave(foodItem.id);
        updateFoodItemInLists({ ...foodItem, isSaved: false });
      } else {
        await api.foodItems.save(foodItem.id);
        updateFoodItemInLists({ ...foodItem, isSaved: true });
      }
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSavingFoodItemId(null);
    }
  };

  useEffect(() => {
    if (scannedFoodItemId === null || isEditing) {
      setLoadingScannedFood(false);
      setScannedFoodError(null);
      return;
    }

    let cancelled = false;
    setLoadingScannedFood(true);
    setScannedFoodError(null);

    void api.foodItems
      .getById(scannedFoodItemId)
      .then((foodItem) => {
        if (!cancelled) {
          selectFoodItem(foodItem);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setScannedFoodError(errorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingScannedFood(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEditing, scannedFoodItemId]);

  const applyRecentFood = async (foodLog: FoodLog) => {
    if (foodLog.foodItemId !== null) {
      try {
        const foodItem = await api.foodItems.getById(foodLog.foodItemId);
        selectFoodItem(foodItem, inferMultiplier(foodLog, foodItem));
        return;
      } catch {
        // Fall back to the stored snapshot if the reusable food is gone.
      }
    }

    const current = getValues();
    reset(
      formValuesFromFood(foodLog, {
        date: current.loggedDate,
        time: current.loggedTime,
      }),
    );
    setSelectedFood(null);
    setServingMultiplier('1');
    setSaveAsReusableFood(false);
    setShowMore(trackingMode === 'complex' || hasOptionalDetails(foodLog));
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
      <FoodLogSkeleton
        title={isEditing ? 'Edit food' : 'Log food again'}
        footerRows={isEditing ? 3 : 1}
        subtitle={
          isEditing
            ? 'Review and correct this entry.'
            : 'Review the copied values before saving.'
        }
      />
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
      contentClassName="gap-6 pb-8"
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
              : 'Add what you ate and the details you want to track.'
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

      {!isEditing ? (
        <View className="gap-4">
          <View className="gap-3">
            <View className="gap-0.5">
              <AppText variant="heading">Find a food</AppText>
              <AppText variant="caption" muted>
                Search saved and reusable foods, or log manually below.
              </AppText>
            </View>
            <AppInput
              label="Search foods"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Greek yogurt"
              value={foodSearchQuery}
              onChangeText={setFoodSearchQuery}
            />
            <Pressable
              accessibilityLabel="Scan barcode"
              accessibilityRole="button"
              className="flex-row items-center justify-between border-y border-line py-3 active:bg-[#F6F6F6]"
              onPress={() => router.push('/barcode-scan' as Href)}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
                  <Camera
                    color={colors.light.ink}
                    size={18}
                    strokeWidth={2.3}
                  />
                </View>
                <View className="gap-0.5">
                  <AppText variant="label">Scan barcode</AppText>
                  <AppText variant="caption" muted>
                    Look up packaged foods faster.
                  </AppText>
                </View>
              </View>
              {loadingScannedFood ? (
                <AppText variant="caption" muted>
                  Loading
                </AppText>
              ) : null}
            </Pressable>
            {trackingMode === 'complex' ? (
              <AppText variant="caption" className="text-muted">
                Detailed mode can use richer nutrient data when a saved food
                includes it.
              </AppText>
            ) : null}
            {scannedFoodError === null ? null : (
              <ErrorState
                title="Scanned food is unavailable"
                message={scannedFoodError}
              />
            )}
          </View>

          {selectedFood === null ? null : (
            <View className="gap-3 border-y border-line py-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <AppText variant="caption" muted>
                    Selected food
                  </AppText>
                  <AppText variant="label" numberOfLines={1}>
                    {selectedFood.name}
                  </AppText>
                </View>
                <Pressable
                  accessibilityLabel="Clear selected food"
                  accessibilityRole="button"
                  className="rounded-full bg-[#F4F4F4] px-3.5 py-2 active:bg-primary-soft"
                  onPress={clearSelectedFood}
                >
                  <AppText variant="label" className="text-ink">
                    Clear
                  </AppText>
                </Pressable>
              </View>
              <ServingMultiplierControl
                value={servingMultiplier}
                onChange={setServingMultiplier}
              />
              {Object.keys(selectedFood.nutrients).length === 0 ||
              trackingMode !== 'complex' ? null : (
                <AppText variant="caption" className="text-muted">
                  {Object.keys(selectedFood.nutrients).length} more nutrients
                  available
                </AppText>
              )}
            </View>
          )}

          {foodSearchQuery.trim().length >= 2 ? (
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <AppText variant="label">Search results</AppText>
                {searchingFoods ? (
                  <AppText variant="caption" muted>
                    Searching
                  </AppText>
                ) : null}
              </View>
              {foodSearchError === null ? null : (
                <ErrorState
                  title="Food search is unavailable"
                  message={foodSearchError}
                />
              )}
              {foodSearchResults.length === 0 &&
              !searchingFoods &&
              searchedFoodQuery === foodSearchQuery.trim() ? (
                <View className="gap-1 border-y border-line py-4">
                  <AppText variant="label">No foods found yet</AppText>
                  <AppText variant="caption" muted>
                    Save a manual entry as reusable food to build your food
                    list.
                  </AppText>
                </View>
              ) : foodSearchResults.length > 0 ? (
                <View className="border-y border-line">
                  {foodSearchResults.map((foodItem, index) => (
                    <View
                      key={foodItem.id}
                      className={index === 0 ? '' : 'border-t border-line'}
                    >
                      <FoodItemChoiceRow
                        foodItem={foodItem}
                        mode={trackingMode}
                        selected={selectedFood?.id === foodItem.id}
                        saving={savingFoodItemId === foodItem.id}
                        onPress={() => selectFoodItem(foodItem)}
                        onToggleSave={() => void toggleSavedFood(foodItem)}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : savedFoods.length > 0 ? (
            <View className="gap-2">
              <AppText variant="label">Saved foods</AppText>
              <View className="border-y border-line">
                {savedFoods.map((foodItem, index) => (
                  <View
                    key={foodItem.id}
                    className={index === 0 ? '' : 'border-t border-line'}
                  >
                    <FoodItemChoiceRow
                      foodItem={foodItem}
                      mode={trackingMode}
                      selected={selectedFood?.id === foodItem.id}
                      saving={savingFoodItemId === foodItem.id}
                      onPress={() => selectFoodItem(foodItem)}
                      onToggleSave={() => void toggleSavedFood(foodItem)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : savedFoodsError !== null ? (
            <ErrorState
              title="Saved foods are unavailable"
              message={savedFoodsError}
              onRetry={() => void loadForm()}
            />
          ) : savedFoodsLoaded ? (
            <View className="gap-1 border-y border-line py-4">
              <AppText variant="label">Saved foods will appear here</AppText>
              <AppText variant="caption" muted>
                Save foods you use often to log faster next time.
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      {!isEditing && foodSearchQuery.trim().length >= 2 ? (
        <View className="gap-1 border-t border-line pt-4">
          <AppText variant="label">Manual entry</AppText>
          <AppText variant="caption" muted>
            Enter the food yourself when search does not have it yet.
          </AppText>
        </View>
      ) : null}

      {!isEditing && recentFoods.length > 0 ? (
        <View className="gap-3">
          <View className="gap-0.5">
            <AppText variant="heading">Recent foods</AppText>
            <AppText variant="caption" muted>
              Tap one to prefill the form.
            </AppText>
          </View>
          <View className="overflow-hidden rounded-[28px] bg-module">
            {recentFoods.map((foodLog, index) => (
              <Pressable
                key={foodLog.id}
                accessibilityLabel={`Use recent food ${foodLog.foodName}`}
                accessibilityRole="button"
                className={`flex-row items-center justify-between gap-3 px-4 py-3.5 ${
                  index === 0 ? '' : 'border-t border-line'
                } active:bg-module-muted`}
                onPress={() => void applyRecentFood(foodLog)}
              >
                <View className="min-w-0 flex-1 gap-0.5">
                  <AppText variant="label" numberOfLines={1}>
                    {foodLog.foodName}
                  </AppText>
                  <AppText variant="caption" muted>
                    {foodLog.mealType} · {foodLog.protein.toFixed(1)} g protein
                  </AppText>
                </View>
                <AppText variant="label" className="text-ink tabular-nums">
                  {foodLog.calories} kcal
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {!isEditing && recentError !== null ? (
        <ErrorState
          title="Recent foods are unavailable"
          message={recentError}
          onRetry={() => void loadForm()}
        />
      ) : null}

      <FormSection title="Food details" variant="open">
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
                      className={`min-h-10 items-center justify-center rounded-full px-3.5 py-2 ${
                        selected ? 'bg-primary' : 'bg-module'
                      }`}
                      onPress={() => field.onChange(meal)}
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
          className="flex-row items-center justify-between rounded-[24px] bg-module px-4 py-3.5 active:bg-module-muted"
          onPress={() => setShowMore((current) => !current)}
        >
          <View className="gap-0.5">
            <AppText variant="label">
              {showMore
                ? 'Hide optional details'
                : trackingMode === 'complex'
                  ? 'Show detailed nutrition'
                  : 'More details'}
            </AppText>
            <AppText variant="caption" muted>
              {trackingMode === 'complex'
                ? 'Macros, nutrients, serving, and notes'
                : 'Optional nutrition, serving, and notes'}
            </AppText>
          </View>
          <AppText className="text-primary-dark">
            {showMore ? '−' : '+'}
          </AppText>
        </Pressable>

        {showMore ? (
          <View className="gap-4 rounded-[28px] bg-module px-4 py-4">
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

        {!isEditing && selectedFood === null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ checked: saveAsReusableFood }}
            className="flex-row items-center justify-between gap-3 border-t border-line pt-4"
            onPress={() => setSaveAsReusableFood((current) => !current)}
          >
            <View className="min-w-0 flex-1 gap-0.5">
              <AppText variant="label">Save as reusable food</AppText>
              <AppText variant="caption" muted>
                Keep this food available for faster logging later.
              </AppText>
            </View>
            <View
              className={`h-7 w-12 justify-center rounded-full px-1 ${
                saveAsReusableFood
                  ? 'items-end bg-primary'
                  : 'items-start bg-[#E8E8E5]'
              }`}
            >
              <View className="h-5 w-5 rounded-full bg-white" />
            </View>
          </Pressable>
        ) : null}
      </FormSection>

      <FormSection
        title="Date and time"
        description={`Use the time you ate in ${timezone}.`}
        variant="open"
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
