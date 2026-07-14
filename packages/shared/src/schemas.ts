import { z } from 'zod';
import {
  ACTIVITY_LEVELS,
  FOOD_ITEM_SOURCE_TYPES,
  FOOD_ITEM_TYPES,
  FOOD_SOURCE_PROVIDERS,
  GOAL_PACES,
  GOAL_TYPES,
  MEAL_TYPES,
  RECOMMENDATION_SEVERITIES,
  RECOMMENDATION_STATUSES,
  SEXES,
  TRACKING_MODES,
  TRAINING_STYLES,
} from './enums.js';
import {
  NORMALIZED_NUTRIENT_KEYS,
  NUTRIENT_CATALOG,
  NUTRIENT_UNITS,
  type NormalizedNutrientKey,
} from './nutrients.js';
import {
  MAX_SERVING_QUANTITY,
  SERVING_UNIT_FAMILIES,
  SERVING_UNITS,
  classifyServingUnit,
} from './servings.js';
import {
  PHOTO_ANALYSIS_MAX_ITEMS,
  PHOTO_ANALYSIS_MAX_COVERAGE_LABELS,
  PHOTO_ANALYSIS_MAX_GROUPS,
  PHOTO_CONFIDENCE_LEVELS,
  PHOTO_REPRESENTATION_KINDS,
  PHOTO_REPRESENTATION_MODES,
  PHOTO_REPRESENTATION_OVERLAP_STATUSES,
  PHOTO_QUANTITY_STATES,
  PHOTO_QUANTITY_UNITS,
} from './constants.js';
import { parsedServingSuggestionSchema } from './serving-text.js';
import type { AiFoodParseCandidate } from './types.js';

const optionalNonNegativeDecimal = z
  .number()
  .nonnegative()
  .nullable()
  .optional();

const localDateSchema = z.iso.date();

const dateRangeSchema = z
  .strictObject({
    startDate: localDateSchema.optional(),
    endDate: localDateSchema.optional(),
  })
  .refine(
    ({ startDate, endDate }) =>
      startDate === undefined || endDate === undefined || startDate <= endDate,
    {
      message: 'startDate must not be after endDate',
      path: ['startDate'],
    },
  );

export const timezoneSchema = z.string().refine(
  (timezone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'timezone must be a valid IANA timezone' },
);

export const goalTypeSchema = z.enum(GOAL_TYPES);
export const sexSchema = z.enum(SEXES);
export const activityLevelSchema = z.enum(ACTIVITY_LEVELS);
export const trainingStyleSchema = z.enum(TRAINING_STYLES);
export const goalPaceSchema = z.enum(GOAL_PACES);
export const trackingModeSchema = z.enum(TRACKING_MODES);
export const mealTypeSchema = z.enum(MEAL_TYPES);
export const recommendationSeveritySchema = z.enum(RECOMMENDATION_SEVERITIES);
export const recommendationStatusSchema = z.enum(RECOMMENDATION_STATUSES);
export const foodItemSourceTypeSchema = z.enum(FOOD_ITEM_SOURCE_TYPES);
export const foodItemTypeSchema = z.enum(FOOD_ITEM_TYPES);
export const foodSourceProviderSchema = z.enum(FOOD_SOURCE_PROVIDERS);
export const recommendationsQuerySchema = z.strictObject({
  status: recommendationStatusSchema.optional().default('active'),
});

export const profileSchema = z.strictObject({
  name: z.string().trim().min(1),
  age: z.number().int().nonnegative(),
  birthDate: localDateSchema,
  sex: sexSchema,
  heightInches: z.number().int().positive(),
  timezone: timezoneSchema,
  startingWeightLb: z.number().positive(),
  activityLevel: activityLevelSchema,
  trainingStyle: trainingStyleSchema,
});

const goalsBaseSchema = z.strictObject({
  goalType: goalTypeSchema,
  goalPace: goalPaceSchema.nullable(),
  targetWeightLb: z.number().positive(),
  targetCalories: z.number().int().nonnegative(),
  targetProteinGrams: z.number().nonnegative(),
});

export const goalsSchema = goalsBaseSchema.refine(
  ({ goalType, goalPace }) =>
    (goalType === 'maintain' && goalPace === null) ||
    (goalType === 'lose' &&
      (goalPace === 'slow' ||
        goalPace === 'moderate' ||
        goalPace === 'aggressive')) ||
    (goalType === 'gain' &&
      (goalPace === 'lean_bulk' ||
        goalPace === 'moderate_bulk' ||
        goalPace === 'aggressive_bulk')),
  {
    message: 'goalPace must match goalType',
    path: ['goalPace'],
  },
);

export const trackingPreferencesSchema = z.strictObject({
  mode: trackingModeSchema,
  waterTrackingEnabled: z.boolean(),
});

export const setupStatusSchema = z
  .strictObject({
    profileComplete: z.boolean(),
    goalsComplete: z.boolean(),
    preferencesComplete: z.boolean(),
    isComplete: z.boolean(),
  })
  .refine(
    ({ profileComplete, goalsComplete, preferencesComplete, isComplete }) =>
      isComplete === (profileComplete && goalsComplete && preferencesComplete),
    {
      message: 'isComplete must match the section completion state',
      path: ['isComplete'],
    },
  );

export const setupInputSchema = z
  .strictObject({
    profile: profileSchema.omit({ age: true }),
    goals: goalsBaseSchema.omit({
      targetCalories: true,
      targetProteinGrams: true,
    }),
    preferences: trackingPreferencesSchema,
  })
  .refine(
    ({ goals }) =>
      (goals.goalType === 'maintain' && goals.goalPace === null) ||
      (goals.goalType === 'lose' &&
        (goals.goalPace === 'slow' ||
          goals.goalPace === 'moderate' ||
          goals.goalPace === 'aggressive')) ||
      (goals.goalType === 'gain' &&
        (goals.goalPace === 'lean_bulk' ||
          goals.goalPace === 'moderate_bulk' ||
          goals.goalPace === 'aggressive_bulk')),
    {
      message: 'goalPace must match goalType',
      path: ['goals', 'goalPace'],
    },
  );

export const setupResultSchema = z.strictObject({
  profile: profileSchema,
  goals: goalsSchema,
  preferences: trackingPreferencesSchema,
  calculatedTargets: z.strictObject({
    targetCalories: z.number().int().nonnegative(),
    targetProteinGrams: z.number().nonnegative(),
  }),
  status: setupStatusSchema,
});

export type SetupInput = z.infer<typeof setupInputSchema>;

export const setupPreviewResultSchema = z.strictObject({
  age: z.number().int().nonnegative(),
  calculatedTargets: z.strictObject({
    targetCalories: z.number().int().nonnegative(),
    targetProteinGrams: z.number().nonnegative(),
  }),
});

export const nutrientUnitSchema = z.enum(NUTRIENT_UNITS);

export const normalizedNutrientKeySchema = z.enum(NORMALIZED_NUTRIENT_KEYS);

export const normalizedNutrientAmountSchema = z.strictObject({
  amount: z.number().nonnegative(),
  unit: nutrientUnitSchema,
});

export const normalizedNutrientsInputSchema = z
  .record(z.string().trim().min(1), normalizedNutrientAmountSchema)
  .superRefine((nutrients, context) => {
    for (const [key, nutrient] of Object.entries(nutrients)) {
      if (!NORMALIZED_NUTRIENT_KEYS.includes(key as NormalizedNutrientKey)) {
        context.addIssue({
          code: 'custom',
          message: 'nutrient key must be a normalized nutrient',
          path: [key],
        });
        continue;
      }

      const catalogEntry = NUTRIENT_CATALOG[key as NormalizedNutrientKey];
      if (nutrient.unit !== catalogEntry.defaultUnit) {
        context.addIssue({
          code: 'custom',
          message: `unit must be ${catalogEntry.defaultUnit} for ${key}`,
          path: [key, 'unit'],
        });
      }
    }
  });

const persistedServingNumberSchema = z
  .number()
  .finite()
  .positive()
  .max(MAX_SERVING_QUANTITY);
const persistedNutritionNumberSchema = z.number().finite().nonnegative();
const persistedServingUnitSchema = z.enum(SERVING_UNITS);
const persistedServingUnitFamilySchema = z.enum(SERVING_UNIT_FAMILIES);

const persistedServingOptionSchema = z
  .strictObject({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    quantity: persistedServingNumberSchema,
    unit: persistedServingUnitSchema,
    unitFamily: persistedServingUnitFamilySchema,
    equivalentWeightGrams: persistedServingNumberSchema.nullable(),
    equivalentVolumeMl: persistedServingNumberSchema.nullable(),
    source: z.enum(['provider', 'manual']),
    trust: z.literal('trusted'),
    provider: foodSourceProviderSchema.nullable(),
    providerDescription: z.string().trim().min(1).nullable(),
  })
  .superRefine((option, context) => {
    const classification = classifyServingUnit(option.unit);
    if (classification?.family !== option.unitFamily) {
      context.addIssue({
        code: 'custom',
        message: 'unitFamily must match the canonical serving unit',
        path: ['unitFamily'],
      });
    }
    if (
      option.equivalentWeightGrams === null &&
      option.equivalentVolumeMl === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'an alternate serving option needs a physical equivalent',
        path: ['equivalentWeightGrams'],
      });
    }
    if (option.source === 'provider' && option.provider === null) {
      context.addIssue({
        code: 'custom',
        message: 'provider options require a provider',
        path: ['provider'],
      });
    }
    if (
      option.source === 'manual' &&
      (option.provider !== null || option.providerDescription !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'manual options cannot claim provider metadata',
        path: ['provider'],
      });
    }
  });

export const foodItemServingOptionsSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    options: z.array(persistedServingOptionSchema).min(1),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    const fingerprints = new Set<string>();
    for (const [index, option] of value.options.entries()) {
      const fingerprint = [
        option.unit,
        option.quantity,
        option.equivalentWeightGrams,
        option.equivalentVolumeMl,
        option.source,
        option.provider,
      ].join('|');
      if (ids.has(option.id) || fingerprints.has(fingerprint)) {
        context.addIssue({
          code: 'custom',
          message:
            'serving option IDs and semantic relationships must be unique',
          path: ['options', index],
        });
      }
      ids.add(option.id);
      fingerprints.add(fingerprint);
    }
  });

const snapshotBasisSchema = z
  .strictObject({
    quantity: persistedServingNumberSchema,
    unit: persistedServingUnitSchema,
    unitFamily: persistedServingUnitFamilySchema,
    displayText: z.string().trim().min(1).nullable(),
    equivalentWeightGrams: persistedServingNumberSchema.nullable(),
    equivalentVolumeMl: persistedServingNumberSchema.nullable(),
  })
  .superRefine((basis, context) => {
    if (classifyServingUnit(basis.unit)?.family !== basis.unitFamily) {
      context.addIssue({
        code: 'custom',
        message: 'basis unit family mismatch',
        path: ['unitFamily'],
      });
    }
  });

const exactResolutionSchema = z.strictObject({
  status: z.literal('exact'),
  reason: z.enum(['same_basis', 'direct_count_basis']),
  multiplier: z.number().finite().positive(),
  resolvedWeightGrams: persistedServingNumberSchema.nullable(),
  resolvedVolumeMl: persistedServingNumberSchema.nullable(),
});
const convertedResolutionSchema = z.strictObject({
  status: z.literal('converted'),
  reason: z.enum([
    'standard_mass_conversion',
    'standard_volume_conversion',
    'trusted_serving_weight',
    'trusted_serving_volume',
  ]),
  multiplier: z.number().finite().positive(),
  resolvedWeightGrams: persistedServingNumberSchema.nullable(),
  resolvedVolumeMl: persistedServingNumberSchema.nullable(),
});

const noOverrideFieldSchema = z.strictObject({
  applied: z.literal(false),
  value: z.null(),
});
const overrideField = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion('applied', [
    noOverrideFieldSchema,
    z.strictObject({ applied: z.literal(true), value }),
  ]);

const nutritionOverrideSnapshotSchema = z.strictObject({
  semantics: z.literal('post_scale_absolute_v1'),
  mode: trackingModeSchema,
  calories: overrideField(persistedNutritionNumberSchema.int()),
  protein: overrideField(persistedNutritionNumberSchema),
  carbs: overrideField(persistedNutritionNumberSchema.nullable()),
  fat: overrideField(persistedNutritionNumberSchema.nullable()),
  fiber: overrideField(persistedNutritionNumberSchema.nullable()),
  sugar: overrideField(persistedNutritionNumberSchema.nullable()),
  sodium: overrideField(persistedNutritionNumberSchema.int().nullable()),
  nutrients: overrideField(normalizedNutrientsInputSchema.nullable()),
});

const snapshotProvenanceSchema = z.discriminatedUnion('basisOrigin', [
  z.strictObject({
    basisOrigin: z.literal('food_item'),
    foodItemId: z.uuid(),
    sourceType: foodItemSourceTypeSchema,
    sourceProvider: foodSourceProviderSchema.nullable(),
    sourceId: z.string().trim().min(1).nullable(),
    trustLevel: z.literal('trusted'),
  }),
  z.strictObject({
    basisOrigin: z.literal('manual_basis'),
    foodItemId: z.null(),
    sourceType: z.null(),
    sourceProvider: z.null(),
    sourceId: z.null(),
    trustLevel: z.literal('user_entered'),
  }),
  z.strictObject({
    basisOrigin: z.literal('ai_estimate'),
    foodItemId: z.null(),
    sourceType: z.null(),
    sourceProvider: z.null(),
    sourceId: z.null(),
    trustLevel: z.literal('low'),
  }),
]);

export const foodLogServingSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    nutritionBasis: snapshotBasisSchema,
    requestedServing: z.strictObject({
      quantity: persistedServingNumberSchema,
      unit: persistedServingUnitSchema,
      unitFamily: persistedServingUnitFamilySchema,
      servingOptionId: z.string().trim().min(1).nullable(),
      selectedServingOption: persistedServingOptionSchema.nullable(),
    }),
    resolution: z.discriminatedUnion('status', [
      exactResolutionSchema,
      convertedResolutionSchema,
    ]),
    basisNutrition: z.strictObject({
      calories: persistedNutritionNumberSchema.int(),
      protein: persistedNutritionNumberSchema,
      carbs: persistedNutritionNumberSchema.nullable(),
      fat: persistedNutritionNumberSchema.nullable(),
      fiber: persistedNutritionNumberSchema.nullable(),
      sugar: persistedNutritionNumberSchema.nullable(),
      sodium: persistedNutritionNumberSchema.int().nullable(),
      nutrients: normalizedNutrientsInputSchema,
    }),
    nutritionOverride: nutritionOverrideSnapshotSchema.nullable(),
    provenance: snapshotProvenanceSchema,
  })
  .superRefine((snapshot, context) => {
    const requested = classifyServingUnit(snapshot.requestedServing.unit);
    if (requested?.family !== snapshot.requestedServing.unitFamily) {
      context.addIssue({
        code: 'custom',
        message: 'requested unit family mismatch',
        path: ['requestedServing', 'unitFamily'],
      });
    }
    const option = snapshot.requestedServing.selectedServingOption;
    if (
      (option === null) !==
        (snapshot.requestedServing.servingOptionId === null) ||
      (option !== null &&
        option.id !== snapshot.requestedServing.servingOptionId)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'selected option ID mismatch',
        path: ['requestedServing', 'servingOptionId'],
      });
    }
  });

export type FoodItemServingOptions = z.infer<
  typeof foodItemServingOptionsSchema
>;
export type FoodLogServingSnapshot = z.infer<
  typeof foodLogServingSnapshotSchema
>;

const canonicalDecimalStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/, {
    message: 'value must be a canonical non-negative decimal string',
  });

const recipeSnapshotServingOptionSchema = z.strictObject({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  quantity: canonicalDecimalStringSchema,
  unit: persistedServingUnitSchema,
  unitFamily: persistedServingUnitFamilySchema,
  equivalentWeightGrams: canonicalDecimalStringSchema.nullable(),
  equivalentVolumeMl: canonicalDecimalStringSchema.nullable(),
  source: z.enum(['provider', 'manual']),
  trust: z.literal('trusted'),
  provider: foodSourceProviderSchema.nullable(),
  providerDescription: z.string().trim().min(1).nullable(),
});

const recipeNutritionSnapshotSchema = z.strictObject({
  calories: canonicalDecimalStringSchema,
  protein: canonicalDecimalStringSchema,
  carbs: canonicalDecimalStringSchema.nullable(),
  fat: canonicalDecimalStringSchema.nullable(),
  fiber: canonicalDecimalStringSchema.nullable(),
  sugar: canonicalDecimalStringSchema.nullable(),
  sodium: canonicalDecimalStringSchema.nullable(),
  nutrients: z.partialRecord(
    normalizedNutrientKeySchema,
    z.strictObject({
      amount: canonicalDecimalStringSchema,
      unit: nutrientUnitSchema,
    }),
  ),
});

const recipeMaterializedNutritionSchema = z.strictObject({
  calories: persistedNutritionNumberSchema.int(),
  protein: persistedNutritionNumberSchema,
  carbs: persistedNutritionNumberSchema.nullable(),
  fat: persistedNutritionNumberSchema.nullable(),
  fiber: persistedNutritionNumberSchema.nullable(),
  sugar: persistedNutritionNumberSchema.nullable(),
  sodium: persistedNutritionNumberSchema.int().nullable(),
  nutrients: normalizedNutrientsInputSchema,
});

export const recipeIngredientSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  foodItem: z.strictObject({
    id: z.uuid(),
    name: z.string().trim().min(1),
  }),
  nutritionBasis: z.strictObject({
    quantity: canonicalDecimalStringSchema,
    unit: persistedServingUnitSchema,
    unitFamily: persistedServingUnitFamilySchema,
    displayText: z.string().trim().min(1).nullable(),
    equivalentWeightGrams: canonicalDecimalStringSchema.nullable(),
    equivalentVolumeMl: canonicalDecimalStringSchema.nullable(),
  }),
  requestedServing: z.strictObject({
    quantity: canonicalDecimalStringSchema,
    unit: persistedServingUnitSchema,
    unitFamily: persistedServingUnitFamilySchema,
    servingOptionId: z.string().trim().min(1).nullable(),
    selectedServingOption: recipeSnapshotServingOptionSchema.nullable(),
  }),
  resolution: z.strictObject({
    status: z.enum(['exact', 'converted']),
    reason: z.enum([
      'same_basis',
      'direct_count_basis',
      'standard_mass_conversion',
      'standard_volume_conversion',
      'trusted_serving_weight',
      'trusted_serving_volume',
    ]),
    multiplier: canonicalDecimalStringSchema,
    resolvedWeightGrams: canonicalDecimalStringSchema.nullable(),
    resolvedVolumeMl: canonicalDecimalStringSchema.nullable(),
  }),
  resolvedNutrition: recipeNutritionSnapshotSchema,
  provenance: snapshotProvenanceSchema,
});

export const recipeNutritionSummarySnapshotSchema = z.strictObject({
  fullPrecision: recipeNutritionSnapshotSchema,
  materialized: recipeMaterializedNutritionSchema,
});

export const recipeSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(2),
  calculationSchemaVersion: z.literal(1),
  recipe: z.strictObject({
    id: z.uuid(),
    name: z.string().trim().min(1),
    description: z.string().nullable(),
    portionCount: z.number().int().positive(),
    finalCookedWeightGrams: canonicalDecimalStringSchema.nullable(),
  }),
  ingredients: z.array(recipeIngredientSnapshotSchema).min(1),
  recipeTotals: recipeNutritionSnapshotSchema,
  loggedNutrition: recipeNutritionSnapshotSchema,
  ingredientContributions: z
    .array(
      z.strictObject({
        recipeIngredientId: z.uuid(),
        position: z.number().int().nonnegative(),
        nutrition: recipeNutritionSnapshotSchema,
      }),
    )
    .min(1),
  loggedAmount: canonicalDecimalStringSchema,
  loggedUnit: z.enum(['portion', 'g']),
});

export type CanonicalDecimalString = z.infer<
  typeof canonicalDecimalStringSchema
>;
export type RecipeIngredientSnapshot = z.infer<
  typeof recipeIngredientSnapshotSchema
>;
export type RecipeNutritionSnapshot = z.infer<
  typeof recipeNutritionSnapshotSchema
>;
export type RecipeMaterializedNutrition = z.infer<
  typeof recipeMaterializedNutritionSchema
>;
export type RecipeNutritionSummarySnapshot = z.infer<
  typeof recipeNutritionSummarySnapshotSchema
>;
export type RecipeSnapshot = z.infer<typeof recipeSnapshotSchema>;

export const recipeServingInputSchema = z.strictObject({
  quantity: z.number().finite().positive().max(MAX_SERVING_QUANTITY),
  unit: z.string().trim().min(1),
  servingOptionId: z.string().trim().min(1).nullable().optional(),
});

export const mixedMealSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  calculationSchemaVersion: z.literal(1),
  mixedMeal: z.strictObject({
    name: z.string().trim().min(1),
    description: z.string().nullable(),
  }),
  ingredients: z.array(recipeIngredientSnapshotSchema).min(1),
  mealTotals: recipeNutritionSnapshotSchema,
  ingredientContributions: z
    .array(
      z.strictObject({
        position: z.number().int().nonnegative(),
        nutrition: recipeNutritionSnapshotSchema,
      }),
    )
    .min(1),
  loggedNutrition: recipeNutritionSnapshotSchema,
});

export type MixedMealSnapshot = z.infer<typeof mixedMealSnapshotSchema>;

export const mixedMealIngredientInputSchema = z.strictObject({
  foodItemId: z.uuid(),
  serving: recipeServingInputSchema,
});

export const mixedMealSaveAsRecipeInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  portionCount: z.number().int().positive().max(10_000).optional(),
  finalCookedWeightGrams: z
    .number()
    .finite()
    .positive()
    .max(MAX_SERVING_QUANTITY)
    .nullable()
    .optional(),
});

export const mixedMealPreviewInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  items: z.array(mixedMealIngredientInputSchema).min(1).max(100),
});

export const mixedMealCreateInputSchema = mixedMealPreviewInputSchema.extend({
  mealType: mealTypeSchema,
  loggedAt: z.iso.datetime(),
  notes: z.string().trim().min(1).nullable().optional(),
  saveAsRecipe: z
    .union([z.literal(true), mixedMealSaveAsRecipeInputSchema])
    .optional(),
});

export type MixedMealIngredientInput = z.infer<
  typeof mixedMealIngredientInputSchema
>;
export type MixedMealPreviewInput = z.infer<typeof mixedMealPreviewInputSchema>;
export type MixedMealCreateInput = z.infer<typeof mixedMealCreateInputSchema>;

export const recipeIngredientInputSchema = z.strictObject({
  foodItemId: z.uuid(),
  serving: recipeServingInputSchema,
});

const recipeMetadataInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  portionCount: z.number().int().positive().max(10_000),
  finalCookedWeightGrams: z
    .number()
    .finite()
    .positive()
    .max(MAX_SERVING_QUANTITY)
    .nullable()
    .optional(),
});

export const recipeCreateInputSchema = recipeMetadataInputSchema.extend({
  ingredients: z.array(recipeIngredientInputSchema).min(1).max(100),
});

export const recipeUpdateInputSchema = recipeMetadataInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Provide at least one recipe field to update.',
  });

export const recipeIngredientSchema = z.strictObject({
  id: z.uuid(),
  foodItemId: z.uuid().nullable(),
  position: z.number().int().nonnegative(),
  snapshot: recipeIngredientSnapshotSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const recipeSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  portionCount: z.number().int().positive(),
  finalCookedWeightGrams: z.number().positive().nullable(),
  gramLoggingAvailable: z.boolean(),
  ingredients: z.array(recipeIngredientSchema).min(1),
  total: recipeNutritionSummarySnapshotSchema,
  perPortion: recipeNutritionSummarySnapshotSchema,
  perGram: recipeNutritionSummarySnapshotSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const recipesResponseSchema = z.strictObject({
  recipes: z.array(recipeSchema),
});

export type RecipeServingInput = z.infer<typeof recipeServingInputSchema>;
export type RecipeIngredientInput = z.infer<typeof recipeIngredientInputSchema>;
export type RecipeCreateInput = z.infer<typeof recipeCreateInputSchema>;
export type RecipeUpdateInput = z.infer<typeof recipeUpdateInputSchema>;
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeLogInputSchema = z.strictObject({
  amount: z.number().finite().positive().max(MAX_SERVING_QUANTITY),
  unit: z.enum(['portion', 'g']),
  mealType: mealTypeSchema,
  loggedAt: z.iso.datetime(),
  notes: z.string().nullable().optional(),
});

export type RecipeLogInput = z.infer<typeof recipeLogInputSchema>;

export const foodLogInputSchema = z.strictObject({
  foodItemId: z.uuid().nullable().optional(),
  foodName: z.string().min(1),
  mealType: mealTypeSchema,
  calories: z.number().int().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: optionalNonNegativeDecimal,
  fat: optionalNonNegativeDecimal,
  fiber: optionalNonNegativeDecimal,
  sugar: optionalNonNegativeDecimal,
  sodium: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  servingQuantity: z.number().positive().nullable().optional(),
  servingUnit: z.string().min(1).nullable().optional(),
  loggedAt: z.iso.datetime(),
  nutrients: normalizedNutrientsInputSchema.nullable().optional(),
});

const servingRequestInputSchema = z.strictObject({
  quantity: z.number().finite().positive().max(MAX_SERVING_QUANTITY),
  unit: z.string().trim().min(1),
  servingOptionId: z.string().trim().min(1).nullable().optional(),
});

const foodLogNutritionOverrideSchema = z
  .strictObject({
    mode: trackingModeSchema,
    calories: z.number().int().nonnegative().nullable().optional(),
    protein: optionalNonNegativeDecimal,
    carbs: optionalNonNegativeDecimal,
    fat: optionalNonNegativeDecimal,
    fiber: optionalNonNegativeDecimal,
    sugar: optionalNonNegativeDecimal,
    sodium: z.number().int().nonnegative().nullable().optional(),
    nutrients: normalizedNutrientsInputSchema.nullable().optional(),
  })
  .superRefine((override, context) => {
    if (
      override.mode === 'simple' &&
      override.nutrients !== undefined &&
      override.nutrients !== null &&
      Object.keys(override.nutrients).length > 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Simple mode can only override main nutrients',
        path: ['nutrients'],
      });
    }
  });

export const foodLogFromFoodItemInputSchema = z
  .strictObject({
    foodItemId: z.uuid(),
    mealType: mealTypeSchema,
    loggedAt: z.iso.datetime(),
    servingMultiplier: z.number().finite().positive().optional(),
    serving: servingRequestInputSchema.optional(),
    notes: z.string().nullable().optional(),
    nutritionOverride: foodLogNutritionOverrideSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.serving !== undefined && input.servingMultiplier !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'serving and servingMultiplier cannot be combined',
        path: ['serving'],
        params: { code: 'SERVING_CONFLICT' },
      });
    }
  });

export const foodLogUpdateInputSchema = z.strictObject({
  foodItemId: z.uuid().nullable().optional(),
  foodName: z.string().min(1).optional(),
  mealType: mealTypeSchema.optional(),
  calories: z.number().int().nonnegative().optional(),
  protein: z.number().nonnegative().optional(),
  carbs: optionalNonNegativeDecimal,
  fat: optionalNonNegativeDecimal,
  fiber: optionalNonNegativeDecimal,
  sugar: optionalNonNegativeDecimal,
  sodium: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  servingQuantity: z.number().positive().nullable().optional(),
  servingUnit: z.string().min(1).nullable().optional(),
  loggedAt: z.iso.datetime().optional(),
  nutrients: normalizedNutrientsInputSchema.nullable().optional(),
  serving: servingRequestInputSchema.optional(),
  clearNutritionOverride: z.boolean().optional(),
  nutritionOverride: foodLogNutritionOverrideSchema.optional(),
  recipeId: z.unknown().optional(),
  recipeSnapshot: z.unknown().optional(),
  mixedMealSnapshot: z.unknown().optional(),
  servingSnapshot: z.unknown().optional(),
  source: z.unknown().optional(),
  sourceType: z.unknown().optional(),
  sourceProvider: z.unknown().optional(),
  sourceId: z.unknown().optional(),
  provenance: z.unknown().optional(),
});

export const foodLogsFromFoodItemsInputSchema = z
  .strictObject({
    mealType: mealTypeSchema,
    loggedAt: z.iso.datetime(),
    notes: z.string().trim().min(1).nullable().optional(),
    items: z
      .array(
        z.strictObject({
          foodItemId: z.uuid(),
          servingMultiplier: z.number().finite().positive().optional(),
          serving: servingRequestInputSchema.optional(),
          nutritionOverride: foodLogNutritionOverrideSchema.optional(),
        }),
      )
      .min(1)
      .max(12),
  })
  .superRefine((input, context) => {
    for (const [index, item] of input.items.entries()) {
      if (item.serving !== undefined && item.servingMultiplier !== undefined)
        context.addIssue({
          code: 'custom',
          message: 'serving and servingMultiplier cannot be combined',
          path: ['items', index, 'serving'],
          params: { code: 'SERVING_CONFLICT' },
        });
    }
  });

const foodLogFoodItemCandidateInputSchema = z.strictObject({
  candidateType: z.literal('food_item'),
  foodItemId: z.uuid(),
  servingMultiplier: z.number().finite().positive().optional(),
  serving: servingRequestInputSchema.optional(),
  nutritionOverride: foodLogNutritionOverrideSchema.optional(),
});

const foodLogExternalCandidateInputSchema = z.strictObject({
  candidateType: z.literal('external_food'),
  sourceProvider: z.literal('usda_fdc'),
  sourceId: z.string().trim().regex(/^\d+$/),
  servingMultiplier: z.number().finite().positive().optional(),
  serving: servingRequestInputSchema.optional(),
  nutritionOverride: foodLogNutritionOverrideSchema.optional(),
});

export const foodLogsFromCandidatesInputSchema = z
  .strictObject({
    mealType: mealTypeSchema,
    loggedAt: z.iso.datetime(),
    notes: z.string().trim().min(1).nullable().optional(),
    items: z
      .array(
        z.discriminatedUnion('candidateType', [
          foodLogFoodItemCandidateInputSchema,
          foodLogExternalCandidateInputSchema,
        ]),
      )
      .min(1)
      .max(12),
  })
  .superRefine((input, context) => {
    for (const [index, item] of input.items.entries()) {
      if (item.serving !== undefined && item.servingMultiplier !== undefined) {
        context.addIssue({
          code: 'custom',
          message: 'serving and servingMultiplier cannot be combined',
          path: ['items', index, 'serving'],
          params: { code: 'SERVING_CONFLICT' },
        });
      }
    }
  });

export const foodLogFromAiEstimateInputSchema = z.strictObject({
  source: z.literal('ai_estimate'),
  trustLevel: z.literal('low'),
  reviewed: z.literal(true),
  edited: z.boolean(),
  foodName: z.string().trim().min(1),
  mealType: mealTypeSchema,
  calories: z.number().int().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: optionalNonNegativeDecimal,
  sugar: optionalNonNegativeDecimal,
  sodium: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
  servingQuantity: z.number().positive().nullable().optional(),
  servingUnit: z.string().trim().min(1).nullable().optional(),
  loggedAt: z.iso.datetime(),
});

export const aiFoodParseInputSchema = z.strictObject({
  description: z.string().trim().min(1),
});

export const aiNutritionEstimateInputSchema = z.strictObject({
  parsedName: z.string().trim().min(1).max(120),
  quantityText: z.string().trim().min(1).max(80).nullable().optional(),
  servingText: z.string().trim().min(1).max(120).nullable().optional(),
  description: z.string().trim().min(1).max(500).nullable().optional(),
});

export const photoConfidenceLevelSchema = z.enum(PHOTO_CONFIDENCE_LEVELS);
export const photoQuantityStateSchema = z.enum(PHOTO_QUANTITY_STATES);
export const photoQuantityUnitSchema = z.enum(PHOTO_QUANTITY_UNITS);
export const photoRepresentationModeSchema = z.enum(PHOTO_REPRESENTATION_MODES);
export const photoRepresentationKindSchema = z.enum(PHOTO_REPRESENTATION_KINDS);
export const photoRepresentationOverlapStatusSchema = z.enum(
  PHOTO_REPRESENTATION_OVERLAP_STATUSES,
);

export const photoCoverageSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(PHOTO_ANALYSIS_MAX_COVERAGE_LABELS);

const photoCountLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/);

const photoNonCountableLabelTokens = new Set([
  'cheese',
  'food',
  'item',
  'meal',
  'parmesan',
  'pasta',
  'rice',
  'sauce',
  'serving',
]);

export const photoProvisionalQuantitySchema = z.discriminatedUnion('state', [
  z
    .strictObject({
      state: z.literal('estimated'),
      amount: z.number().finite().positive().max(MAX_SERVING_QUANTITY),
      unit: photoQuantityUnitSchema,
      countLabel: photoCountLabelSchema.nullable(),
      rawText: z.string().trim().min(1).max(120),
      confidence: photoConfidenceLevelSchema,
    })
    .superRefine((quantity, context) => {
      if (quantity.unit === 'count') {
        if (quantity.countLabel === null) {
          context.addIssue({
            code: 'custom',
            message: 'count quantities require a countLabel',
            path: ['countLabel'],
          });
          return;
        }
        const labelTokens = quantity.countLabel.toLowerCase().split(' ');
        if (
          labelTokens.some((token) => photoNonCountableLabelTokens.has(token))
        ) {
          context.addIssue({
            code: 'custom',
            message: 'countLabel is not a defensible discrete object',
            path: ['countLabel'],
          });
        }
      } else if (quantity.countLabel !== null) {
        context.addIssue({
          code: 'custom',
          message: 'countLabel is only valid for count quantities',
          path: ['countLabel'],
        });
      }
    }),
  z.strictObject({
    state: z.literal('no_responsible_estimate'),
  }),
]);

export const photoNormalizedRegionSchema = z
  .strictObject({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().min(0).max(1),
    height: z.number().finite().min(0).max(1),
  })
  .superRefine((region, context) => {
    if (region.x + region.width > 1) {
      context.addIssue({
        code: 'custom',
        message: 'region must remain within the normalized image width',
        path: ['width'],
      });
    }
    if (region.y + region.height > 1) {
      context.addIssue({
        code: 'custom',
        message: 'region must remain within the normalized image height',
        path: ['height'],
      });
    }
  });

export const photoServingResolutionSchema = z.enum([
  'not_attempted',
  'supported',
  'needs_review',
]);

export const photoUnresolvedReasonSchema = z.enum([
  'low_identity_confidence',
  'ambiguous_identity',
  'no_trusted_candidate',
  'low_candidate_confidence',
  'portion_needs_review',
]);

export const photoProvisionalPortionSchema = z.strictObject({
  rawQuantityText: z.string().trim().min(1).max(120).nullable(),
  rawServingText: z.string().trim().min(1).max(120).nullable(),
  confidence: photoConfidenceLevelSchema.nullable(),
  parsed: parsedServingSuggestionSchema.nullable(),
  quantity: photoProvisionalQuantitySchema,
  servingResolution: photoServingResolutionSchema,
});

export const photoAdjudicationMetadataSchema = z.strictObject({
  selectionSource: z.enum(['deterministic', 'ai_adjudicated', 'user_required']),
  status: z.enum([
    'not_needed',
    'selected',
    'rejected_all',
    'no_decision',
    'unavailable',
    'invalid_response',
  ]),
  confidence: photoConfidenceLevelSchema.nullable(),
  reviewReason: z.string().trim().min(1).max(160).nullable(),
});

export const photoNutritionEstimateSchema = z.strictObject({
  calories: z.number().int().positive(),
  proteinGrams: z.number().finite().nonnegative(),
  carbohydrateGrams: z.number().finite().nonnegative(),
  fatGrams: z.number().finite().nonnegative(),
  confidence: z.enum(['low', 'medium']),
  basis: z.enum(['structured_quantity', 'portion_shown']),
  source: z.literal('ai_estimate'),
  trust: z.literal('low'),
  editable: z.literal(true),
  linkedFoodItemId: z.null(),
  label: z.string().trim().min(1).max(160),
});

export const photoRepresentationItemSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  representationGroupId: z.string().trim().min(1).max(80),
  recognizedName: z.string().trim().min(1).max(120),
  preparationForm: z.string().trim().min(1).max(80).nullable(),
  quantity: photoProvisionalQuantitySchema,
  identityConfidence: photoConfidenceLevelSchema,
  region: photoNormalizedRegionSchema.nullable(),
  representationKind: photoRepresentationKindSchema,
  active: z.boolean(),
  coverage: photoCoverageSchema,
  excludedCoverage: photoCoverageSchema,
  visiblePortionDescription: z.string().trim().min(1).max(160).nullable(),
});

const photoInactiveRepresentationItemSchema =
  photoRepresentationItemSchema.extend({
    active: z.literal(false),
  });

export const photoRepresentationAlternativeSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  representation: photoRepresentationModeSchema,
  active: z.literal(false),
  itemIds: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  items: z.array(photoInactiveRepresentationItemSchema).min(1).max(8),
});

export const photoRepresentationGroupSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  activeRepresentation: photoRepresentationModeSchema,
  activeItemIds: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  representationConfidence: photoConfidenceLevelSchema,
  region: photoNormalizedRegionSchema.nullable(),
  overlapStatus: photoRepresentationOverlapStatusSchema,
  reviewReason: z.string().trim().min(1).max(160).nullable(),
  alternatives: z.array(photoRepresentationAlternativeSchema).max(1),
});

function isPhotoCandidate(value: unknown): value is AiFoodParseCandidate {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (
    (candidate.candidateType !== 'food_item' &&
      candidate.candidateType !== 'external_food') ||
    typeof candidate.rank !== 'number' ||
    !Number.isInteger(candidate.rank) ||
    candidate.rank < 1 ||
    typeof candidate.defaultServingMultiplier !== 'number' ||
    !Number.isFinite(candidate.defaultServingMultiplier) ||
    !['high', 'medium', 'low'].includes(String(candidate.confidence))
  ) {
    return false;
  }

  if (candidate.candidateType === 'food_item') {
    return (
      typeof candidate.foodItem === 'object' && candidate.foodItem !== null
    );
  }

  return (
    candidate.externalFood !== null &&
    typeof candidate.externalFood === 'object'
  );
}

const photoCandidateSchema = z.custom<AiFoodParseCandidate>(isPhotoCandidate, {
  message: 'candidate must use the existing trusted candidate contract',
});

export const photoRecognizedItemSchema = z.strictObject({
  id: z.string().regex(/^photo-item-[1-8]$/),
  recognizedName: z.string().trim().min(1).max(120),
  preparationForm: z.string().trim().min(1).max(80).nullable(),
  identityConfidence: photoConfidenceLevelSchema,
  portionConfidence: photoConfidenceLevelSchema.nullable(),
  region: photoNormalizedRegionSchema.nullable(),
  provisionalPortion: photoProvisionalPortionSchema.nullable(),
  reviewStatus: z.enum(['matched', 'needs_review', 'unmatched']),
  selectedCandidateId: z.string().trim().min(1).nullable(),
  loggable: z.boolean(),
  candidates: z.array(photoCandidateSchema),
  unresolvedReason: photoUnresolvedReasonSchema.nullable(),
  representationGroupId: z.string().trim().min(1).max(80),
  representationKind: photoRepresentationKindSchema,
  active: z.literal(true),
  coverage: photoCoverageSchema,
  excludedCoverage: photoCoverageSchema,
  visiblePortionDescription: z.string().trim().min(1).max(160).nullable(),
  adjudication: photoAdjudicationMetadataSchema.optional(),
  estimatedNutrition: photoNutritionEstimateSchema.optional(),
});

export const photoAnalysisResultSchema = z.strictObject({
  status: z.enum(['recognized', 'no_food_detected']),
  items: z.array(photoRecognizedItemSchema).max(PHOTO_ANALYSIS_MAX_ITEMS),
  representationGroups: z
    .array(photoRepresentationGroupSchema)
    .max(PHOTO_ANALYSIS_MAX_GROUPS),
});

const optionalNonNegativeInteger = z
  .number()
  .int()
  .nonnegative()
  .nullable()
  .optional();

const additionalNutrientSchema = z.strictObject({
  amount: z.number().nonnegative(),
  unit: z.string().trim().min(1),
});

export const foodItemInputSchema = z.strictObject({
  name: z.string().trim().min(1),
  brandName: z.string().trim().min(1).nullable().optional(),
  foodType: foodItemTypeSchema,
  servingQuantity: z.number().positive().nullable().optional(),
  servingUnit: z.string().trim().min(1).nullable().optional(),
  servingWeightGrams: z.number().positive().nullable().optional(),
  calories: optionalNonNegativeInteger,
  protein: optionalNonNegativeDecimal,
  carbs: optionalNonNegativeDecimal,
  fat: optionalNonNegativeDecimal,
  fiber: optionalNonNegativeDecimal,
  sugar: optionalNonNegativeDecimal,
  sodium: optionalNonNegativeInteger,
  additionalNutrients: z
    .record(z.string().trim().min(1), additionalNutrientSchema)
    .nullable()
    .optional(),
  nutrients: normalizedNutrientsInputSchema.nullable().optional(),
});

const manualNutritionSchema = z.strictObject({
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  fiber: z.number().finite().nonnegative().nullable().optional(),
  sugar: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().int().nullable().optional(),
  nutrients: normalizedNutrientsInputSchema.nullable().optional(),
});

const manualBasisSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('per_100g') }),
  z
    .strictObject({
      mode: z.literal('per_serving'),
      quantity: z.number().finite().positive().max(MAX_SERVING_QUANTITY),
      unit: persistedServingUnitSchema,
      equivalentWeightGrams: z
        .number()
        .finite()
        .positive()
        .max(MAX_SERVING_QUANTITY)
        .nullable()
        .optional(),
      equivalentVolumeMl: z
        .number()
        .finite()
        .positive()
        .max(MAX_SERVING_QUANTITY)
        .nullable()
        .optional(),
    })
    .superRefine((basis, context) => {
      if (
        basis.equivalentWeightGrams !== undefined &&
        basis.equivalentVolumeMl !== undefined &&
        basis.equivalentWeightGrams !== null &&
        basis.equivalentVolumeMl !== null
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Declare at most one physical equivalence.',
        });
      }
    }),
]);

export const manualFoodItemCreateInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  brandName: z.string().trim().min(1).max(200).nullable().optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  basis: manualBasisSchema,
  nutrition: manualNutritionSchema,
  servingOptions: foodItemServingOptionsSchema.nullable().optional(),
});

export const manualFoodItemUpdateInputSchema =
  manualFoodItemCreateInputSchema.partial();

export type ManualFoodItemCreateInput = z.infer<
  typeof manualFoodItemCreateInputSchema
>;
export type ManualFoodItemUpdateInput = z.infer<
  typeof manualFoodItemUpdateInputSchema
>;

const booleanQuerySchema = z.preprocess((value) => {
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const foodItemsQuerySchema = z.strictObject({
  query: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  savedOnly: booleanQuerySchema.default(false),
});

export const foodLibrarySectionSchema = z.enum([
  'saved',
  'my_foods',
  'recent',
  'archived',
]);

export const foodLibraryQuerySchema = z.strictObject({
  section: foodLibrarySectionSchema.default('saved'),
  query: z.string().trim().min(1).optional(),
  sort: z.enum(['recent', 'name']).default('recent'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const foodItemDefaultServingInputSchema = z.strictObject({
  quantity: z.number().finite().positive().max(MAX_SERVING_QUANTITY),
  unit: z.string().trim().min(1),
  servingOptionId: z.string().trim().min(1).nullable().optional(),
});

export const foodLogSaveAsManualFoodInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(1000).nullable().optional(),
});

export const foodItemSearchCandidatesInputSchema = z.strictObject({
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(10).default(8),
});

export const foodItemExternalCandidateInputSchema = z.strictObject({
  sourceProvider: z.literal('usda_fdc'),
  sourceId: z.string().trim().regex(/^\d+$/),
});

export const foodBarcodeParamsSchema = z.strictObject({
  barcode: z.string().trim().min(1),
});

export const foodBarcodeQuerySchema = z.strictObject({
  regionCode: z.string().trim().min(1).optional(),
});

export const foodBarcodeLookupInputSchema = z.strictObject({
  barcode: z.string().trim().min(1),
  barcodeCandidates: z
    .array(z.string().trim().min(1).max(32))
    .min(1)
    .max(6)
    .optional(),
  regionCode: z.string().trim().min(1).optional(),
});

export const weightLogInputSchema = z.strictObject({
  weightLb: z.number().positive(),
  loggedAt: z.iso.datetime(),
});

export type FoodLogInput = z.infer<typeof foodLogInputSchema>;
export type FoodLogUpdateInput = z.infer<typeof foodLogUpdateInputSchema>;
export type FoodLogFromFoodItemInput = z.infer<
  typeof foodLogFromFoodItemInputSchema
>;
export type FoodLogsFromFoodItemsInput = z.infer<
  typeof foodLogsFromFoodItemsInputSchema
>;
export type FoodLogsFromCandidatesInput = z.infer<
  typeof foodLogsFromCandidatesInputSchema
>;
export type FoodLogFromAiEstimateInput = z.infer<
  typeof foodLogFromAiEstimateInputSchema
>;
export type FoodLogNutritionOverride = z.infer<
  typeof foodLogNutritionOverrideSchema
>;
export type AiFoodParseInput = z.infer<typeof aiFoodParseInputSchema>;
export type AiNutritionEstimateInput = z.infer<
  typeof aiNutritionEstimateInputSchema
>;
export type FoodItemInput = z.infer<typeof foodItemInputSchema>;
export type FoodItemSearchCandidatesInput = z.infer<
  typeof foodItemSearchCandidatesInputSchema
>;
export type FoodItemExternalCandidateInput = z.infer<
  typeof foodItemExternalCandidateInputSchema
>;
export type FoodLibraryQuery = z.infer<typeof foodLibraryQuerySchema>;
export type FoodItemDefaultServingInput = z.infer<
  typeof foodItemDefaultServingInputSchema
>;
export type FoodLogSaveAsManualFoodInput = z.infer<
  typeof foodLogSaveAsManualFoodInputSchema
>;
export type FoodBarcodeLookupInput = z.infer<
  typeof foodBarcodeLookupInputSchema
>;
export type WeightLogInput = z.infer<typeof weightLogInputSchema>;

export const idParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const foodLogsQuerySchema = dateRangeSchema
  .extend({
    date: localDateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine(
    ({ date, startDate, endDate }) =>
      date === undefined || (startDate === undefined && endDate === undefined),
    {
      message: 'date cannot be combined with startDate or endDate',
      path: ['date'],
    },
  );

export const weightLogsQuerySchema = dateRangeSchema;

export const dashboardSummaryQuerySchema = z.strictObject({
  date: localDateSchema.optional(),
});

export const advancedAnalyticsQuerySchema = z.strictObject({
  date: localDateSchema.optional(),
  timezone: timezoneSchema.optional(),
  rangeDays: z.coerce.number().int().min(1).max(365).default(30),
});
