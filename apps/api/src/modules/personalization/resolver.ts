import type {
  ActivityLevel,
  GoalType,
  Sex,
  TrainingStyle,
} from '@food-tracker/shared';
import {
  floorRateToStep,
  MIN_AUTOMATIC_RATE_LB_PER_WEEK,
  normalizeRateLbPerWeek,
  roundRateToStep,
} from '@food-tracker/shared';
import {
  calculateEnergyRequirement,
  type EnergyRequirementResult,
} from './energy-requirement.js';

export interface PersonalizationInput {
  birthDate: string;
  timezone?: string;
  sex: Sex;
  heightInches: number;
  currentWeightLb: number | null;
  startingWeightLb?: number | null;
  activityLevel: ActivityLevel;
  trainingStyle: TrainingStyle;
  goalType: GoalType;
  targetWeightLb: number;
  targetRateLbPerWeek?: number | null;
}

export interface PersonalizationPlan {
  age: {
    completedYears: number;
    years: number;
  };
  currentWeight: { valueLb: number; source: 'weightLog' | 'startingWeightLb' };
  energy: EnergyRequirementResult & { recommendedCalories: number };
  protein: { recommendedGrams: number; source: 'personalized' | 'reference' };
  recommendedTargets: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
    sugarGrams: number;
    sodiumMg: number | null;
  };
  goal: { goalType: GoalType; targetWeightLb: number };
  ratePlanning:
    | {
        status: 'available';
        minimumRateLbPerWeek: number;
        selectedRateLbPerWeek: number;
        maximumRateLbPerWeek: number;
        calorieAdjustment: number;
      }
    | {
        status: 'unavailable';
        reason:
          | 'age_model_not_supported'
          | 'no_safe_rate'
          | 'goal_type_not_supported';
        calorieAdjustment: 0;
      };
  estimatedGoal:
    | { status: 'available'; date: string; weeks: number }
    | { status: 'reached' }
    | {
        status: 'unavailable';
        reason:
          | 'age_model_not_supported'
          | 'no_safe_rate'
          | 'goal_type_not_supported';
      };
}

const MS_PER_DAY = 86_400_000;
const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

function dateOnly(value: Date, timezone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateValue(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`);
}

export function isBirthDateInFuture(
  birthDate: string,
  timezone: string,
  asOf = new Date(),
): boolean {
  return dateValue(birthDate) > dateValue(dateOnly(asOf, timezone));
}

export function calculateAge(
  birthDate: string,
  asOf: Date | string = new Date(),
  timezone = 'UTC',
): number {
  const today = typeof asOf === 'string' ? asOf : dateOnly(asOf, timezone);
  if (dateValue(birthDate) > dateValue(today)) {
    throw new Error('Birth date cannot be in the future.');
  }
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const current = new Date(`${today}T00:00:00.000Z`);
  let age = current.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayThisYear = Date.UTC(
    current.getUTCFullYear(),
    birth.getUTCMonth(),
    birth.getUTCDate(),
  );
  if (current.getTime() < birthdayThisYear) age -= 1;
  return Math.max(0, age);
}

function ageYears(birthDate: string, asOf: Date, timezone: string): number {
  const today = dateOnly(asOf, timezone);
  const completed = calculateAge(birthDate, asOf, timezone);
  const current = dateValue(today);
  const currentYearBirthday = Date.parse(
    `${today.slice(0, 4)}-${birthDate.slice(5)}T00:00:00.000Z`,
  );
  const previousBirthday =
    currentYearBirthday <= current
      ? currentYearBirthday
      : Date.parse(
          `${Number(today.slice(0, 4)) - 1}-${birthDate.slice(5)}T00:00:00.000Z`,
        );
  return (
    completed +
    Math.max(0, current - previousBirthday) / (365.2425 * MS_PER_DAY)
  );
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validWeight(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function youngerProteinRdaGramsPerKg(ageYears: number, sex: Sex): number {
  if (ageYears < 0.5) return sex === 'male' ? 1.52 : 1.52;
  if (ageYears < 1) return 1.2;
  if (ageYears < 4) return 1.05;
  if (ageYears < 14) return 0.95;
  return 0.85;
}

function sodiumCdrMg(completedAge: number): number | null {
  if (completedAge < 1) return null;
  if (completedAge <= 3) return 1200;
  if (completedAge <= 8) return 1500;
  if (completedAge <= 13) return 1800;
  if (completedAge <= 50) return 2300;
  if (completedAge <= 70) return 2000;
  return 1800;
}

function rateMaximum(
  goalType: GoalType,
  weightLb: number,
  baseline: number,
  sex: Sex,
): number {
  if (goalType === 'maintain') return 0;
  if (goalType === 'gain')
    return floorRateToStep(Math.min(1, weightLb * 0.005));
  const floor = sex === 'female' ? 1200 : 1500;
  const floorLimited = floorRateToStep(Math.max(0, (baseline - floor) / 500));
  return floorRateToStep(Math.min(2, weightLb * 0.01, floorLimited));
}

function estimateDate(asOf: Date, timezone: string, days: number): string {
  const today = dateOnly(asOf, timezone);
  const next = new Date(dateValue(today));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function resolvePersonalizationPlan(
  input: PersonalizationInput,
  asOf = new Date(),
): PersonalizationPlan {
  const timezone = input.timezone ?? 'UTC';
  const years = ageYears(input.birthDate, asOf, timezone);
  const completedYears = calculateAge(input.birthDate, asOf, timezone);
  const currentWeightLb = validWeight(input.currentWeightLb)
    ? input.currentWeightLb
    : input.startingWeightLb;
  if (!validWeight(currentWeightLb))
    throw new Error('A valid current or starting weight is required');

  const energy = calculateEnergyRequirement({
    ageYears: years,
    ageMonths: years * 12,
    sex: input.sex,
    heightCm: input.heightInches * IN_TO_CM,
    weightKg: currentWeightLb * LB_TO_KG,
    activityLevel: input.activityLevel,
  });
  const baselineCalories = Math.max(0, energy.kcal);
  const adultPlanning = completedYears >= 19;
  const maximumRate = adultPlanning
    ? rateMaximum(input.goalType, currentWeightLb, baselineCalories, input.sex)
    : 0;
  const requestedRate = input.targetRateLbPerWeek ?? 0;
  const selectedRate =
    adultPlanning &&
    input.goalType !== 'maintain' &&
    maximumRate >= MIN_AUTOMATIC_RATE_LB_PER_WEEK
      ? Math.min(
          Math.max(
            MIN_AUTOMATIC_RATE_LB_PER_WEEK,
            roundRateToStep(requestedRate),
          ),
          maximumRate,
        )
      : 0;
  const adjustment =
    selectedRate *
    500 *
    (input.goalType === 'lose' ? -1 : input.goalType === 'gain' ? 1 : 0);
  const floor = input.sex === 'female' ? 1200 : 1500;
  const recommendedCalories =
    Math.round(Math.max(floor, baselineCalories + adjustment) / 10) * 10;

  const proteinRda =
    completedYears < 19 ? youngerProteinRdaGramsPerKg(years, input.sex) : 0.8;
  const adultTrainingMultiplier =
    input.trainingStyle === 'athlete'
      ? 1.1
      : input.trainingStyle === 'weight_training' ||
          input.trainingStyle === 'mixed'
        ? 0.85
        : input.trainingStyle === 'cardio'
          ? 0.7
          : 0.6;
  const protein =
    completedYears < 19
      ? currentWeightLb * LB_TO_KG * proteinRda
      : Math.max(
          currentWeightLb * proteinRda,
          currentWeightLb * adultTrainingMultiplier,
        );
  const remaining = Math.max(0, recommendedCalories - protein * 4);
  const carbs = Math.max(1, (remaining * 0.5) / 4);
  const fat = Math.max(1, (remaining * 0.5) / 9);
  const distance = Math.abs(currentWeightLb - input.targetWeightLb);
  const reached = distance <= 0.1;
  const ratePlanning =
    adultPlanning && input.goalType !== 'maintain' && selectedRate >= 0.25
      ? {
          status: 'available' as const,
          minimumRateLbPerWeek: MIN_AUTOMATIC_RATE_LB_PER_WEEK,
          selectedRateLbPerWeek: normalizeRateLbPerWeek(selectedRate),
          maximumRateLbPerWeek: normalizeRateLbPerWeek(maximumRate),
          calorieAdjustment: adjustment,
        }
      : {
          status: 'unavailable' as const,
          reason: (input.goalType === 'maintain'
            ? 'goal_type_not_supported'
            : adultPlanning
              ? 'no_safe_rate'
              : 'age_model_not_supported') as
            | 'no_safe_rate'
            | 'age_model_not_supported'
            | 'goal_type_not_supported',
          calorieAdjustment: 0 as const,
        };
  const estimatedGoal = reached
    ? { status: 'reached' as const }
    : ratePlanning.status === 'available'
      ? {
          status: 'available' as const,
          date: estimateDate(
            asOf,
            timezone,
            Math.ceil((distance / ratePlanning.selectedRateLbPerWeek) * 7),
          ),
          weeks: Math.ceil(distance / ratePlanning.selectedRateLbPerWeek),
        }
      : { status: 'unavailable' as const, reason: ratePlanning.reason };

  return {
    age: { completedYears, years },
    currentWeight: {
      valueLb: currentWeightLb,
      source: validWeight(input.currentWeightLb)
        ? 'weightLog'
        : 'startingWeightLb',
    },
    energy: { ...energy, recommendedCalories },
    protein: {
      recommendedGrams: round(protein, 1),
      source: completedYears < 19 ? 'reference' : 'personalized',
    },
    recommendedTargets: {
      calories: recommendedCalories,
      proteinGrams: round(protein, 1),
      carbsGrams: round(carbs, 1),
      fatGrams: round(fat, 1),
      fiberGrams: round(Math.max(1, (recommendedCalories / 1000) * 14), 1),
      sugarGrams: round(Math.max(1, (recommendedCalories * 0.1) / 4), 1),
      sodiumMg: sodiumCdrMg(completedYears),
    },
    goal: { goalType: input.goalType, targetWeightLb: input.targetWeightLb },
    ratePlanning,
    estimatedGoal,
  };
}
