import type { ComponentType } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Beef,
  Droplet,
  Flame,
  Utensils,
  Weight,
  Wheat,
} from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  DEFAULT_TIMEZONE,
  MEAL_TYPES,
  type FoodLog,
  type MealType,
  type WeightLog,
} from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { addLocalDateDays, todayInTimezone } from '@/lib/date-time';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

type HistoryIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

interface DayNutrition {
  calories: number;
  foodCount: number;
}

const ringAccentColors = [
  '#D98275',
  '#C99A58',
  '#679C8C',
  '#6F88B4',
  '#927CAD',
] as const;

function ringAccentAt(index: number): string {
  return (
    ringAccentColors[index % ringAccentColors.length] ?? ringAccentColors[0]
  );
}

function time(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function selectedDateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function dayName(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function dayNumber(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function mealLabel(mealType: MealType): string {
  return `${mealType[0]?.toUpperCase()}${mealType.slice(1)}`;
}

function formatWeight(value: number): string {
  return `${value.toFixed(1)} lb`;
}

function OptionalMacroLine({ food }: { food: FoodLog }) {
  const macros = [
    food.carbs === null ? null : `${food.carbs.toFixed(1)}g carbs`,
    food.fat === null ? null : `${food.fat.toFixed(1)}g fat`,
    food.fiber === null ? null : `${food.fiber.toFixed(1)}g fiber`,
  ].filter((value): value is string => value !== null);

  if (macros.length === 0) {
    return null;
  }

  return (
    <AppText variant="caption" muted numberOfLines={1}>
      {macros.join(' · ')}
    </AppText>
  );
}

function weekDatesFor(value: string): string[] {
  const dayIndex = new Date(`${value}T12:00:00.000Z`).getUTCDay();
  return Array.from({ length: 7 }, (_, index) =>
    addLocalDateDays(value, index - dayIndex),
  );
}

function sumOptional(foods: FoodLog[], key: 'carbs' | 'fat'): number | null {
  const values = foods
    .map((food) => food[key])
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0);
}

function IconDot({
  Icon,
  color = colors.light.ink,
  soft = true,
}: {
  Icon: HistoryIcon;
  color?: string;
  soft?: boolean;
}) {
  return (
    <View
      className={`h-9 w-9 items-center justify-center rounded-full ${
        soft ? 'bg-[#F4F4F4]' : 'bg-primary'
      }`}
    >
      <Icon color={soft ? color : '#FFFFFF'} size={16} strokeWidth={2.15} />
    </View>
  );
}

function CalorieRing({
  calories,
  target,
  accent,
  selected = false,
}: {
  calories: number;
  target: number | null;
  accent: string;
  selected?: boolean;
}) {
  const size = 48;
  const strokeWidth = 3;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const hasCalories = calories > 0;
  const progress =
    target === null || target <= 0
      ? 0
      : Math.min(Math.max(calories / target, 0), 1);
  const progressOffset = circumference * (1 - progress);
  const emptyStroke = selected ? 'rgba(255,255,255,0.34)' : '#D9D9D7';
  const trackStroke = selected ? 'rgba(255,255,255,0.20)' : '#ECECEA';

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      pointerEvents="none"
    >
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={hasCalories ? trackStroke : emptyStroke}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        {...(hasCalories ? {} : { strokeDasharray: [2.5, 5] })}
      />
      {hasCalories && target !== null && target > 0 ? (
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={accent}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transform={`rotate(-90 ${center} ${center})`}
        />
      ) : null}
    </Svg>
  );
}

function MacroRail({
  label,
  value,
  unit = 'g',
  maxValue,
  accent = colors.light.primary,
  Icon,
}: {
  label: string;
  value: number;
  unit?: string;
  maxValue: number;
  accent?: string;
  Icon: HistoryIcon;
}) {
  const progress = maxValue <= 0 ? 0 : Math.min(value / maxValue, 1);

  return (
    <View className="gap-2">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Icon color={accent} size={14} strokeWidth={2.35} />
          <AppText variant="caption" className="text-ink">
            {label}
          </AppText>
        </View>
        <AppText variant="caption" className="text-ink tabular-nums">
          {value.toFixed(value % 1 === 0 ? 0 : 1)} {unit}
        </AppText>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#ECECEA]">
        <View
          className="h-full rounded-full"
          style={{ backgroundColor: accent, width: `${progress * 100}%` }}
        />
      </View>
    </View>
  );
}

function CalorieRail({
  calories,
  target,
}: {
  calories: number;
  target: number | null;
}) {
  const progress =
    target === null || target <= 0
      ? 0
      : Math.min(Math.max(calories / target, 0), 1);

  return (
    <View className="gap-2">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Flame color={ringAccentColors[0]} size={14} strokeWidth={2.35} />
          <AppText variant="caption" className="text-ink">
            Calories
          </AppText>
        </View>
        <AppText variant="caption" className="text-ink tabular-nums">
          {target === null || target <= 0
            ? `${calories.toLocaleString()} kcal`
            : `${calories.toLocaleString()} / ${target.toLocaleString()} kcal`}
        </AppText>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-[#ECECEA]">
        <View
          className="h-full rounded-full"
          style={{
            backgroundColor: ringAccentColors[0],
            width: `${progress * 100}%`,
          }}
        />
      </View>
    </View>
  );
}

function SnapshotToken({
  label,
  value,
  Icon,
  accent,
}: {
  label: string;
  value: string;
  Icon: HistoryIcon;
  accent: string;
}) {
  return (
    <View className="flex-1 gap-2">
      <IconDot Icon={Icon} color={accent} />
      <View className="gap-0.5">
        <AppText variant="caption" className="text-ink">
          {label}
        </AppText>
        <AppText variant="label" className="text-ink tabular-nums">
          {value}
        </AppText>
      </View>
    </View>
  );
}

function HistoryEmptyPrompt({
  title,
  message,
  Icon,
}: {
  title: string;
  message: string;
  Icon: HistoryIcon;
}) {
  return (
    <View className="flex-row items-center gap-4 border-t border-line py-5">
      <IconDot Icon={Icon} color={colors.light.ink} />
      <View className="min-w-0 flex-1 gap-1">
        <AppText variant="label" className="text-ink">
          {title}
        </AppText>
        <AppText muted>{message}</AppText>
      </View>
    </View>
  );
}

function HistoryDayRail({
  selectedDate,
  today,
  dayNutrition,
  calorieTarget,
  onSelect,
}: {
  selectedDate: string;
  today: string;
  dayNutrition: Record<string, DayNutrition>;
  calorieTarget: number | null;
  onSelect: (date: string) => void;
}) {
  const weekDates = weekDatesFor(selectedDate);

  return (
    <View className="gap-3">
      <View className="flex-row justify-between gap-0.5">
        {weekDates.map((date, index) => {
          const selected = date === selectedDate;
          const isToday = date === today;
          const nutrition = dayNutrition[date];
          const calories = nutrition?.calories ?? 0;
          const accent = ringAccentAt(index);
          return (
            <Pressable
              key={date}
              accessibilityLabel={`Show ${selectedDateLabel(date)}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className="min-h-[82px] flex-1 items-center justify-center rounded-full px-0.5 py-2 active:opacity-75"
              onPress={() => onSelect(date)}
            >
              <AppText
                variant="caption"
                className={selected ? 'text-ink' : 'text-muted'}
              >
                {dayName(date).slice(0, 2)}
              </AppText>
              <View className="mt-1 h-12 w-12 items-center justify-center">
                <View className="absolute inset-0 items-center justify-center">
                  <CalorieRing
                    calories={calories}
                    target={calorieTarget}
                    accent={accent}
                    selected={selected}
                  />
                </View>
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    selected ? 'bg-primary' : 'bg-white'
                  }`}
                >
                  <AppText
                    variant="label"
                    className={selected ? 'text-white' : 'text-ink'}
                  >
                    {dayNumber(date)}
                  </AppText>
                </View>
              </View>
              <View
                className={`mt-2 h-1.5 w-1.5 rounded-full ${
                  isToday ? 'bg-primary' : 'bg-transparent'
                }`}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DailyNutritionSnapshot({
  foods,
  weights,
  calorieTarget,
}: {
  foods: FoodLog[];
  weights: WeightLog[];
  calorieTarget: number | null;
}) {
  const calories = foods.reduce((total, food) => total + food.calories, 0);
  const protein = foods.reduce((total, food) => total + food.protein, 0);
  const carbs = sumOptional(foods, 'carbs');
  const fat = sumOptional(foods, 'fat');
  const maxMacro = Math.max(protein, carbs ?? 0, fat ?? 0, 1);
  const latestWeight = weights.at(0);

  return (
    <View className="gap-5">
      <View className="flex-row items-start justify-between gap-5">
        <View className="min-w-0 flex-1 gap-1.5">
          <AppText
            variant="caption"
            className="text-ink uppercase tracking-[1.5px]"
          >
            Logged nutrition
          </AppText>
          <View className="flex-row items-end gap-2">
            <AppText variant="display" className="text-ink tabular-nums">
              {calories.toLocaleString()}
            </AppText>
            <AppText variant="label" className="pb-1.5 text-ink">
              kcal
            </AppText>
          </View>
          <AppText className="text-muted">
            {foods.length === 0
              ? 'Add food to start building this day.'
              : calorieTarget === null || calorieTarget <= 0
                ? `${foods.length} ${foods.length === 1 ? 'entry' : 'entries'} logged.`
                : `${Math.max(calorieTarget - calories, 0).toLocaleString()} kcal left for this day.`}
          </AppText>
        </View>
        <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-[#F4F4F4]">
          <View className="absolute inset-0 items-center justify-center">
            <CalorieRing
              calories={calories}
              target={calorieTarget}
              accent={ringAccentColors[0]}
            />
          </View>
          <View className="h-[56px] w-[56px] items-center justify-center rounded-full bg-white">
            <AppText variant="label" className="text-ink tabular-nums">
              {foods.length}
            </AppText>
            <AppText variant="caption" className="text-muted">
              logs
            </AppText>
          </View>
        </View>
      </View>

      <View className="gap-3">
        <CalorieRail calories={calories} target={calorieTarget} />
        <MacroRail
          label="Protein"
          value={protein}
          maxValue={maxMacro}
          accent={ringAccentColors[2]}
          Icon={Beef}
        />
        {carbs === null ? null : (
          <MacroRail
            label="Carbs"
            value={carbs}
            maxValue={maxMacro}
            accent={ringAccentColors[1]}
            Icon={Wheat}
          />
        )}
        {fat === null ? null : (
          <MacroRail
            label="Fat"
            value={fat}
            maxValue={maxMacro}
            accent={ringAccentColors[3]}
            Icon={Droplet}
          />
        )}
      </View>

      <View className="flex-row gap-3">
        <SnapshotToken
          label="Protein"
          value={`${protein.toFixed(1)} g`}
          Icon={Beef}
          accent={ringAccentColors[2]}
        />
        <SnapshotToken
          label="Food"
          value={String(foods.length)}
          Icon={Utensils}
          accent={ringAccentColors[1]}
        />
        <SnapshotToken
          label="Weight"
          value={
            latestWeight === undefined
              ? '—'
              : formatWeight(latestWeight.weightLb)
          }
          Icon={Weight}
          accent={ringAccentColors[3]}
        />
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [dayNutrition, setDayNutrition] = useState<
    Record<string, DayNutrition>
  >({});
  const [calorieTarget, setCalorieTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimezone = useCallback(async () => {
    try {
      return (await api.profile.get()).timezone;
    } catch {
      return DEFAULT_TIMEZONE;
    }
  }, []);

  const loadHistory = useCallback(async (date: string, asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const weekDates = weekDatesFor(date);
      const [weekFoodResults, nextWeights, goals] = await Promise.all([
        Promise.all(
          weekDates.map(async (weekDate) => {
            try {
              return {
                date: weekDate,
                foods: await api.foodLogs.list({ date: weekDate }),
                error: null,
              };
            } catch (weekError) {
              return {
                date: weekDate,
                foods: null,
                error: weekError,
              };
            }
          }),
        ),
        api.weightLogs.list({ date }),
        api.goals.get().catch(() => null),
      ]);
      const selectedResult = weekFoodResults.find(
        (result) => result.date === date,
      );

      if (selectedResult?.foods === null) {
        throw selectedResult.error;
      }

      const nextDayNutrition = weekFoodResults.reduce<
        Record<string, DayNutrition>
      >((accumulator, result) => {
        if (result.foods === null) {
          return accumulator;
        }

        accumulator[result.date] = {
          calories: result.foods.reduce(
            (total, food) => total + food.calories,
            0,
          ),
          foodCount: result.foods.length,
        };
        return accumulator;
      }, {});

      setFoods(selectedResult?.foods ?? []);
      setWeights(nextWeights);
      setDayNutrition(nextDayNutrition);
      setCalorieTarget(goals?.targetCalories ?? null);
      setLoadedDate(date);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (selectedDate === null) {
        void (async () => {
          const nextTimezone = await loadTimezone();
          setTimezone(nextTimezone);
          setSelectedDate(todayInTimezone(nextTimezone));
        })();
        return;
      }

      void loadHistory(selectedDate);
    }, [dataVersion, loadHistory, loadTimezone, selectedDate]),
  );

  const groupedFoods = useMemo(
    () =>
      MEAL_TYPES.map((mealType) => ({
        mealType,
        foods: foods.filter((food) => food.mealType === mealType),
      })).filter((group) => group.foods.length > 0),
    [foods],
  );

  if (selectedDate === null || loading) {
    return (
      <AppScreen backgroundColor="#FFFFFF">
        <LoadingState message="Loading your history…" />
      </AppScreen>
    );
  }

  const today = todayInTimezone(timezone);
  const isToday = selectedDate === today;

  if (error !== null && loadedDate !== selectedDate) {
    return (
      <AppScreen backgroundColor="#FFFFFF">
        <ScreenHeader
          title="History"
          subtitle="Your daily food and weight record."
        />
        <ErrorState
          title="History is unavailable"
          message={error}
          onRetry={() => void loadHistory(selectedDate)}
        />
      </AppScreen>
    );
  }

  const openFood = (food: FoodLog) => {
    router.push({
      pathname: '/food-log',
      params: { id: food.id, date: selectedDate },
    });
  };

  return (
    <AppScreen
      refreshing={refreshing}
      contentClassName="gap-7"
      backgroundColor="#FFFFFF"
      onRefresh={() => void loadHistory(selectedDate, true)}
    >
      <ScreenHeader
        title="History"
        subtitle="Your daily food and weight record."
      />

      <View className="gap-5">
        <View className="flex-row items-center justify-between gap-3">
          <Pressable
            accessibilityLabel="Previous day"
            accessibilityRole="button"
            className="min-h-11 min-w-11 items-center justify-center rounded-full bg-[#F4F4F4] active:opacity-70"
            onPress={() =>
              setSelectedDate((current) =>
                current === null ? current : addLocalDateDays(current, -1),
              )
            }
          >
            <AppText variant="heading" className="text-ink">
              ‹
            </AppText>
          </Pressable>
          <View className="min-w-0 flex-1 items-center gap-0.5">
            <AppText variant="caption" className="text-ink">
              Tracking day
            </AppText>
            <AppText variant="heading" className="text-center text-ink">
              {isToday ? 'Today' : selectedDateLabel(selectedDate)}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Next day"
            accessibilityRole="button"
            className="min-h-11 min-w-11 items-center justify-center rounded-full bg-[#F4F4F4] active:opacity-70"
            onPress={() =>
              setSelectedDate((current) =>
                current === null ? current : addLocalDateDays(current, 1),
              )
            }
          >
            <AppText variant="heading" className="text-ink">
              ›
            </AppText>
          </Pressable>
        </View>
        <HistoryDayRail
          selectedDate={selectedDate}
          today={today}
          dayNutrition={dayNutrition}
          calorieTarget={calorieTarget}
          onSelect={setSelectedDate}
        />
        {isToday ? null : (
          <AppButton
            variant="ghost"
            className="self-center px-4"
            onPress={() => setSelectedDate(today)}
          >
            Return to today
          </AppButton>
        )}
      </View>

      {error === null ? null : (
        <ErrorState
          title="Couldn’t refresh history"
          message={error}
          onRetry={() => void loadHistory(selectedDate)}
        />
      )}

      <DailyNutritionSnapshot
        foods={foods}
        weights={weights}
        calorieTarget={calorieTarget}
      />

      <View className="gap-4">
        <View className="flex-row items-end justify-between gap-3">
          <AppText variant="heading" className="text-ink">
            Food
          </AppText>
          <AppText variant="caption" className="text-muted">
            {foods.length === 0
              ? 'No entries'
              : `${foods.length} ${foods.length === 1 ? 'entry' : 'entries'}`}
          </AppText>
        </View>
        {groupedFoods.length === 0 ? (
          <HistoryEmptyPrompt
            title="Nothing logged yet"
            message="Add what you ate to start building this day."
            Icon={Utensils}
          />
        ) : (
          groupedFoods.map((group) => {
            const calories = group.foods.reduce(
              (total, food) => total + food.calories,
              0,
            );
            const protein = group.foods.reduce(
              (total, food) => total + food.protein,
              0,
            );

            return (
              <View key={group.mealType} className="gap-2.5">
                <View className="flex-row items-end justify-between gap-3">
                  <View className="flex-row items-center gap-2">
                    <Utensils
                      color={ringAccentColors[1]}
                      size={14}
                      strokeWidth={2.35}
                    />
                    <AppText
                      variant="caption"
                      className="text-ink uppercase tracking-[1.4px]"
                    >
                      {mealLabel(group.mealType)}
                    </AppText>
                  </View>
                  <AppText variant="caption" muted className="tabular-nums">
                    {calories} kcal · {protein.toFixed(1)} g protein
                  </AppText>
                </View>
                <View>
                  {group.foods.map((food) => (
                    <Pressable
                      key={food.id}
                      accessibilityLabel={`Edit ${food.foodName}`}
                      accessibilityRole="button"
                      className="flex-row items-center gap-3 border-t border-line py-4 active:bg-[#F6F6F6]"
                      onPress={() => openFood(food)}
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F4]">
                        <AppText variant="label" className="text-ink">
                          {food.foodName.slice(0, 1).toUpperCase()}
                        </AppText>
                      </View>
                      <View className="min-w-0 flex-1 gap-1">
                        <AppText variant="label" numberOfLines={1}>
                          {food.foodName}
                        </AppText>
                        <AppText variant="caption" muted>
                          {time(food.loggedAt, timezone)} ·{' '}
                          {food.protein.toFixed(1)} g protein
                        </AppText>
                        <OptionalMacroLine food={food} />
                      </View>
                      <View className="items-end">
                        <AppText variant="heading" className="tabular-nums">
                          {food.calories.toLocaleString()}
                        </AppText>
                        <View className="flex-row items-center gap-1">
                          <Flame
                            color={ringAccentColors[0]}
                            size={12}
                            strokeWidth={2.35}
                          />
                          <AppText variant="caption" muted>
                            kcal
                          </AppText>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </View>

      <View className="gap-4">
        <View className="flex-row items-end justify-between gap-3">
          <AppText variant="heading" className="text-ink">
            Weight
          </AppText>
          <AppText variant="caption" className="text-muted">
            {weights.length === 0
              ? 'No entry'
              : `${weights.length} ${weights.length === 1 ? 'entry' : 'entries'}`}
          </AppText>
        </View>
        {weights.length === 0 ? (
          <HistoryEmptyPrompt
            title="No weight entry this day"
            message="Log a weight when you want to keep your progress current."
            Icon={Weight}
          />
        ) : (
          <View>
            {weights.map((weight) => (
              <Pressable
                key={weight.id}
                accessibilityLabel={`Edit weight logged ${time(
                  weight.loggedAt,
                  timezone,
                )}`}
                accessibilityRole="button"
                className="flex-row items-center justify-between gap-4 border-t border-line py-4 active:bg-[#F6F6F6]"
                onPress={() =>
                  router.push({
                    pathname: '/weight-log',
                    params: { id: weight.id },
                  })
                }
              >
                <View className="flex-row items-center gap-3">
                  <IconDot Icon={Weight} color={ringAccentColors[3]} />
                  <View className="gap-1">
                    <AppText variant="caption" muted>
                      {time(weight.loggedAt, timezone)}
                    </AppText>
                    <AppText variant="label">Weight entry</AppText>
                  </View>
                </View>
                <AppText variant="heading" className="tabular-nums">
                  {formatWeight(weight.weightLb)}
                </AppText>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </AppScreen>
  );
}
