import { z } from 'zod';
import {
  NUTRIENT_CATALOG,
  NUTRIENT_CATEGORIES,
  NUTRIENT_UNITS,
  type NutrientCategory,
  type NutrientKey,
  type NutrientUnit,
} from './nutrients.js';

export const reportingNutrientCategorySchema = z.enum(NUTRIENT_CATEGORIES);
export const reportingNutrientUnitSchema = z.enum(NUTRIENT_UNITS);

export const reportingNutrientDetailSchema = z.object({
  displayName: z.string(),
  category: reportingNutrientCategorySchema,
  total: z.number().nonnegative(),
  averagePerLoggedDay: z.number().nonnegative(),
  unit: reportingNutrientUnitSchema,
  recordedDayCount: z.number().int().nonnegative(),
});

export const reportingNutrientDetailsSchema = z.record(
  z.string(),
  reportingNutrientDetailSchema,
);

export const reportingNutrientGroups = [
  'general',
  'carbohydrate_fiber',
  'lipids',
  'protein_amino_acid',
  'vitamins',
  'minerals',
  'other',
] as const;

export const reportingNutrientGroupSchema = z.enum(reportingNutrientGroups);

export type ReportingNutrientCategory = NutrientCategory;
export type ReportingNutrientDetail = z.infer<
  typeof reportingNutrientDetailSchema
>;
export type ReportingNutrientDetails = z.infer<
  typeof reportingNutrientDetailsSchema
>;
export type ReportingNutrientGroup = (typeof reportingNutrientGroups)[number];

export function reportingNutrientGroupForCategory(
  category: NutrientCategory,
): ReportingNutrientGroup {
  switch (category) {
    case 'macro':
      return 'general';
    case 'carbohydrate_detail':
      return 'carbohydrate_fiber';
    case 'fat_subtype':
      return 'lipids';
    case 'amino_acid':
      return 'protein_amino_acid';
    case 'vitamin':
      return 'vitamins';
    case 'mineral':
      return 'minerals';
    case 'stimulant':
    case 'other':
      return 'other';
  }
}

export function reportingNutrientCatalogEntry(key: string): {
  key: NutrientKey;
  displayName: string;
  category: NutrientCategory;
  defaultUnit: NutrientUnit;
} | null {
  const entry = NUTRIENT_CATALOG[key as NutrientKey];
  if (entry === undefined) return null;
  return {
    key: entry.key as NutrientKey,
    displayName: entry.displayName,
    category: entry.category,
    defaultUnit: entry.defaultUnit,
  };
}
