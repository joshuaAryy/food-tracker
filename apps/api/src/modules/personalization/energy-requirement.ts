import type { ActivityLevel, Sex } from '@food-tracker/shared';

export type EnergyModel =
  | 'hc_nasem_eer_2023_infant'
  | 'hc_nasem_eer_2023_child'
  | 'hc_nasem_eer_2023_adolescent'
  | 'hc_nasem_eer_2023_adult';

export type PhysicalActivityCategory =
  | 'inactive'
  | 'low_active'
  | 'active'
  | 'very_active';

export interface EnergyRequirementInput {
  ageYears: number;
  ageMonths: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

export interface EnergyRequirementResult {
  kcal: number;
  model: EnergyModel;
  includesGrowthEnergy: boolean;
  activityCategory: PhysicalActivityCategory | 'not_applicable';
  version: 'hc_nasem_eer_2023';
}

const activityCategory = (activity: ActivityLevel): PhysicalActivityCategory =>
  activity === 'sedentary'
    ? 'inactive'
    : activity === 'lightly_active'
      ? 'low_active'
      : activity === 'moderately_active'
        ? 'active'
        : 'very_active';

const CHILD_COEFFICIENTS = {
  male: {
    inactive: [-447.51, 3.68, 13.01, 13.15],
    low_active: [19.12, 3.68, 8.62, 20.28],
    active: [-388.19, 3.68, 12.66, 20.46],
    very_active: [-671.75, 3.68, 15.38, 23.25],
  },
  female: {
    inactive: [55.59, -22.25, 8.43, 17.07],
    low_active: [-297.54, -22.25, 12.77, 14.73],
    active: [-189.55, -22.25, 11.74, 18.34],
    very_active: [-709.59, -22.25, 18.22, 14.25],
  },
} as const;

const ADULT_COEFFICIENTS = {
  male: {
    inactive: [753.07, -10.83, 6.5, 14.1],
    low_active: [581.47, -10.83, 8.3, 14.94],
    active: [1004.82, -10.83, 6.52, 15.91],
    very_active: [-517.88, -10.83, 15.61, 19.11],
  },
  female: {
    inactive: [584.9, -7.01, 5.72, 11.71],
    low_active: [575.77, -7.01, 6.6, 12.14],
    active: [710.25, -7.01, 6.54, 12.34],
    very_active: [511.83, -7.01, 9.07, 12.56],
  },
} as const;

function equation(
  coefficients: readonly [number, number, number, number],
  ageYears: number,
  heightCm: number,
  weightKg: number,
  growth: number,
): number {
  return (
    coefficients[0] +
    coefficients[1] * ageYears +
    coefficients[2] * heightCm +
    coefficients[3] * weightKg +
    growth
  );
}

export function calculateEnergyRequirement(
  input: EnergyRequirementInput,
): EnergyRequirementResult {
  const category = activityCategory(input.activityLevel);

  if (input.ageYears < 3) {
    const growth =
      input.ageMonths < 3
        ? input.sex === 'male'
          ? 200
          : 180
        : input.ageMonths < 6
          ? input.sex === 'male'
            ? 50
            : 60
          : input.ageMonths < 12
            ? 20
            : input.sex === 'male'
              ? 20
              : 15;
    const kcal =
      input.sex === 'male'
        ? -716.45 -
          input.ageYears +
          17.82 * input.heightCm +
          15.06 * input.weightKg +
          growth
        : -69.15 +
          80 * input.ageYears +
          2.65 * input.heightCm +
          54.15 * input.weightKg +
          growth;
    return {
      kcal,
      model: 'hc_nasem_eer_2023_infant',
      includesGrowthEnergy: true,
      activityCategory: 'not_applicable',
      version: 'hc_nasem_eer_2023',
    };
  }

  if (input.ageYears < 19) {
    const growth =
      input.ageYears < 4
        ? input.sex === 'male'
          ? 20
          : 15
        : input.ageYears < 9
          ? 15
          : input.ageYears < 14
            ? input.sex === 'male'
              ? 25
              : 30
            : 20;
    return {
      kcal: equation(
        CHILD_COEFFICIENTS[input.sex][category],
        input.ageYears,
        input.heightCm,
        input.weightKg,
        growth,
      ),
      model:
        input.ageYears < 14
          ? 'hc_nasem_eer_2023_child'
          : 'hc_nasem_eer_2023_adolescent',
      includesGrowthEnergy: true,
      activityCategory: category,
      version: 'hc_nasem_eer_2023',
    };
  }

  return {
    kcal: equation(
      ADULT_COEFFICIENTS[input.sex][category],
      input.ageYears,
      input.heightCm,
      input.weightKg,
      0,
    ),
    model: 'hc_nasem_eer_2023_adult',
    includesGrowthEnergy: false,
    activityCategory: category,
    version: 'hc_nasem_eer_2023',
  };
}
