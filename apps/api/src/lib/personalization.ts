import {
  resolveReportingGoals,
  type SetupInput,
} from '@food-tracker/shared';
import { roundTo } from './serializers.js';

const activityMultipliers = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  athlete: 1.9,
} satisfies Record<SetupInput['profile']['activityLevel'], number>;

const calorieAdjustments = {
  slow: -250,
  moderate: -500,
  aggressive: -750,
  lean_bulk: 250,
  moderate_bulk: 400,
  aggressive_bulk: 600,
} satisfies Record<NonNullable<SetupInput['goals']['goalPace']>, number>;

const trainingProteinMultipliers = {
  none: 0.6,
  cardio: 0.7,
  weight_training: 0.85,
  mixed: 0.85,
  athlete: 1,
} satisfies Record<SetupInput['profile']['trainingStyle'], number>;

function ageOnDate(birthDate: string, today = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return 0;
  }

  let age = today.getUTCFullYear() - year;
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();

  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }

  return age;
}

function sexBmrOffset(sex: SetupInput['profile']['sex']): number {
  return sex === 'male' ? 5 : -161;
}

function calorieFloor(sex: SetupInput['profile']['sex']): number {
  return sex === 'female' ? 1200 : 1500;
}

function proteinMultiplier(input: SetupInput): number {
  const trainingBase = trainingProteinMultipliers[input.profile.trainingStyle];
  const goalBump =
    input.goals.goalType === 'lose'
      ? 0.1
      : input.goals.goalType === 'gain'
        ? 0.05
        : 0;
  const activityBump = input.profile.activityLevel === 'athlete' ? 0.1 : 0;

  return Math.min(1.1, trainingBase + goalBump + activityBump);
}

export function calculateAge(birthDate: string, today = new Date()): number {
  return ageOnDate(birthDate, today);
}

export function calculatePersonalizedTargets(
  input: SetupInput,
  today = new Date(),
): {
  age: number;
  targetCalories: number;
  targetProteinGrams: number;
  targetCarbsGrams: number;
  targetFatGrams: number;
  targetFiberGrams: number;
  limitSugarGrams: number;
  limitSodiumMg: number;
} {
  const age = calculateAge(input.profile.birthDate, today);
  const weightKg = input.profile.startingWeightLb * 0.45359237;
  const heightCm = input.profile.heightInches * 2.54;
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + sexBmrOffset(input.profile.sex);
  const tdee = bmr * activityMultipliers[input.profile.activityLevel];
  const calorieAdjustment =
    input.goals.goalPace === null
      ? 0
      : calorieAdjustments[input.goals.goalPace];
  const targetCalories = Math.max(
    calorieFloor(input.profile.sex),
    Math.round((tdee + calorieAdjustment) / 10) * 10,
  );
  const targetProteinGrams = roundTo(
    input.profile.startingWeightLb * proteinMultiplier(input),
    1,
  );
  const reportingGoals = resolveReportingGoals({
    targetCalories,
    targetProteinGrams,
    targetCarbsGrams: null,
    targetFatGrams: null,
    targetFiberGrams: null,
    limitSugarGrams: null,
    limitSodiumMg: null,
  });
  const requiredGoal = (key: keyof typeof reportingGoals): number => {
    const value = reportingGoals[key]?.value;
    if (value === null || value === undefined) {
      throw new Error(`Unable to derive required reporting goal: ${key}`);
    }
    return value;
  };

  return {
    age,
    targetCalories,
    targetProteinGrams,
    targetCarbsGrams: requiredGoal('carbs'),
    targetFatGrams: requiredGoal('fat'),
    targetFiberGrams: requiredGoal('fiber'),
    limitSugarGrams: requiredGoal('sugar'),
    limitSodiumMg: requiredGoal('sodium'),
  };
}
