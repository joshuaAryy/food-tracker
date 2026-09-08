import {
  NUTRIENT_CATALOG,
  type NormalizedNutrientKey,
  type NutrientKey,
  type NutrientUnit,
} from './nutrients.js';
import { z } from 'zod';

export const REPORTING_GOAL_DIRECTIONS = [
  'target',
  'minimum',
  'limit',
] as const;

export type ReportingGoalDirection = (typeof REPORTING_GOAL_DIRECTIONS)[number];

export const REPORTING_GOAL_SOURCES = [
  'user',
  'personalized',
  'reference',
  'derived',
  'default',
  'missing',
] as const;

export type ReportingGoalSource = (typeof REPORTING_GOAL_SOURCES)[number];

export const reportingGoalDirectionSchema = z.enum(REPORTING_GOAL_DIRECTIONS);
export const reportingGoalSourceSchema = z.enum(REPORTING_GOAL_SOURCES);
export const reportingGoalSchema = z.strictObject({
  value: z.number().nonnegative().nullable(),
  unit: z.enum(['kcal', 'g', 'mg', 'mcg']),
  direction: reportingGoalDirectionSchema,
  source: reportingGoalSourceSchema,
});
export const reportingGoalsSchema = z.record(z.string(), reportingGoalSchema);

export interface ReportingGoal {
  value: number | null;
  unit: NutrientUnit;
  direction: ReportingGoalDirection;
  source: ReportingGoalSource;
}

export type ReportingGoals = Partial<Record<NutrientKey, ReportingGoal>>;

export interface ReportingGoalInputs {
  targetCalories: number | null | undefined;
  targetProteinGrams: number | null | undefined;
  targetCarbsGrams: number | null | undefined;
  targetFatGrams: number | null | undefined;
  targetFiberGrams: number | null | undefined;
  limitSugarGrams: number | null | undefined;
  limitSodiumMg: number | null | undefined;
}

interface DefaultExtendedGoal {
  value: number;
  direction: ReportingGoalDirection;
}

type ExtendedNutrientKey = Exclude<NormalizedNutrientKey, 'water'>;

const DEFAULT_EXTENDED_GOALS: Record<ExtendedNutrientKey, DefaultExtendedGoal> =
  {
    addedSugar: { value: 50, direction: 'limit' },
    starch: { value: 130, direction: 'minimum' },
    solubleFiber: { value: 5, direction: 'minimum' },
    insolubleFiber: { value: 9, direction: 'minimum' },
    sugarAlcohol: { value: 10, direction: 'limit' },
    saturatedFat: { value: 20, direction: 'limit' },
    transFat: { value: 0, direction: 'limit' },
    monounsaturatedFat: { value: 20, direction: 'minimum' },
    polyunsaturatedFat: { value: 20, direction: 'minimum' },
    omega3: { value: 1.6, direction: 'minimum' },
    omega6: { value: 17, direction: 'minimum' },
    cholesterol: { value: 300, direction: 'limit' },
    histidine: { value: 1, direction: 'minimum' },
    isoleucine: { value: 1.9, direction: 'minimum' },
    leucine: { value: 2.6, direction: 'minimum' },
    lysine: { value: 2.1, direction: 'minimum' },
    methionine: { value: 0.9, direction: 'minimum' },
    phenylalanine: { value: 1.75, direction: 'minimum' },
    threonine: { value: 1.05, direction: 'minimum' },
    tryptophan: { value: 0.28, direction: 'minimum' },
    valine: { value: 1.3, direction: 'minimum' },
    alanine: { value: 1, direction: 'minimum' },
    arginine: { value: 1, direction: 'minimum' },
    asparticAcid: { value: 1, direction: 'minimum' },
    cystine: { value: 0.5, direction: 'minimum' },
    glutamicAcid: { value: 1, direction: 'minimum' },
    glycine: { value: 1, direction: 'minimum' },
    proline: { value: 1, direction: 'minimum' },
    serine: { value: 1, direction: 'minimum' },
    tyrosine: { value: 0.8, direction: 'minimum' },
    potassium: { value: 4700, direction: 'minimum' },
    caffeine: { value: 400, direction: 'limit' },
    alcohol: { value: 0, direction: 'limit' },
    oxalate: { value: 50, direction: 'limit' },
    phytate: { value: 1000, direction: 'limit' },
    vitaminA: { value: 900, direction: 'minimum' },
    thiamine: { value: 1.2, direction: 'minimum' },
    riboflavin: { value: 1.3, direction: 'minimum' },
    niacin: { value: 16, direction: 'minimum' },
    pantothenicAcid: { value: 5, direction: 'minimum' },
    vitaminB6: { value: 1.7, direction: 'minimum' },
    biotin: { value: 30, direction: 'minimum' },
    folate: { value: 400, direction: 'minimum' },
    vitaminB12: { value: 2.4, direction: 'minimum' },
    vitaminC: { value: 90, direction: 'minimum' },
    vitaminD: { value: 20, direction: 'minimum' },
    vitaminE: { value: 15, direction: 'minimum' },
    vitaminK: { value: 120, direction: 'minimum' },
    calcium: { value: 1000, direction: 'minimum' },
    iron: { value: 18, direction: 'minimum' },
    magnesium: { value: 420, direction: 'minimum' },
    zinc: { value: 11, direction: 'minimum' },
    phosphorus: { value: 1250, direction: 'minimum' },
    selenium: { value: 55, direction: 'minimum' },
    copper: { value: 0.9, direction: 'minimum' },
    manganese: { value: 2.3, direction: 'minimum' },
    iodine: { value: 150, direction: 'minimum' },
    chromium: { value: 35, direction: 'minimum' },
    molybdenum: { value: 45, direction: 'minimum' },
    chloride: { value: 2300, direction: 'minimum' },
  };

function roundToTenth(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function positiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function goal(
  value: number | null,
  unit: NutrientUnit,
  direction: ReportingGoalDirection,
  source: ReportingGoalSource,
): ReportingGoal {
  return { value, unit, direction, source };
}

function missingGoal(
  unit: NutrientUnit,
  direction: ReportingGoalDirection,
): ReportingGoal {
  return goal(null, unit, direction, 'missing');
}

function explicitOrDerived(
  explicit: number | null | undefined,
  derived: number | null,
  unit: NutrientUnit,
  direction: ReportingGoalDirection,
): ReportingGoal {
  if (positiveFinite(explicit)) return goal(explicit, unit, direction, 'user');
  if (positiveFinite(derived)) return goal(derived, unit, direction, 'derived');
  return missingGoal(unit, direction);
}

/**
 * Legacy pure projection retained for old consumers/tests. API reporting must
 * use the server-owned effective-target adapter; the `default` values below
 * are compatibility metadata, never personalized/reference authority.
 */
export function resolveReportingGoals(
  inputs: ReportingGoalInputs,
): ReportingGoals {
  const calories = positiveFinite(inputs.targetCalories)
    ? inputs.targetCalories
    : null;
  const protein = positiveFinite(inputs.targetProteinGrams)
    ? inputs.targetProteinGrams
    : null;
  const remainingCalories =
    calories !== null && protein !== null
      ? Math.max(0, calories - protein * 4)
      : null;
  const derivedCarbs =
    remainingCalories === null
      ? null
      : roundToTenth(Math.max(1, (remainingCalories * 0.5) / 4));
  const derivedFat =
    remainingCalories === null
      ? null
      : roundToTenth(Math.max(1, (remainingCalories * 0.5) / 9));
  const derivedFiber =
    calories === null
      ? null
      : roundToTenth(Math.max(1, (calories / 1000) * 14));
  const derivedSugar =
    calories === null ? null : roundToTenth(Math.max(1, (calories * 0.1) / 4));

  const goals: ReportingGoals = {
    calories:
      calories === null
        ? missingGoal('kcal', 'target')
        : goal(calories, 'kcal', 'target', 'user'),
    protein:
      protein === null
        ? missingGoal('g', 'minimum')
        : goal(protein, 'g', 'minimum', 'user'),
    carbs: explicitOrDerived(
      inputs.targetCarbsGrams,
      derivedCarbs,
      'g',
      'minimum',
    ),
    fat: explicitOrDerived(inputs.targetFatGrams, derivedFat, 'g', 'minimum'),
    fiber: explicitOrDerived(
      inputs.targetFiberGrams,
      derivedFiber,
      'g',
      'minimum',
    ),
    sugar: explicitOrDerived(
      inputs.limitSugarGrams,
      derivedSugar,
      'g',
      'limit',
    ),
    sodium: positiveFinite(inputs.limitSodiumMg)
      ? goal(inputs.limitSodiumMg, 'mg', 'limit', 'user')
      : calories === null
        ? missingGoal('mg', 'limit')
        : goal(2300, 'mg', 'limit', 'default'),
  };

  for (const [key, defaultGoal] of Object.entries(DEFAULT_EXTENDED_GOALS)) {
    const nutrientKey = key as ExtendedNutrientKey;
    const catalogEntry = NUTRIENT_CATALOG[nutrientKey];
    goals[nutrientKey] = goal(
      defaultGoal.value,
      catalogEntry.defaultUnit,
      defaultGoal.direction,
      'default',
    );
  }

  return goals;
}

export function reportingGoalForKey(
  goals: ReportingGoals,
  key: NutrientKey,
): ReportingGoal | null {
  return goals[key] ?? null;
}
