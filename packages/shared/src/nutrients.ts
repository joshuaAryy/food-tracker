export const NUTRIENT_UNITS = ['kcal', 'g', 'mg', 'mcg'] as const;

export const NUTRIENT_CATEGORIES = [
  'macro',
  'carbohydrate_detail',
  'fat_subtype',
  'amino_acid',
  'vitamin',
  'mineral',
  'stimulant',
  'other',
] as const;

export const NUTRIENT_STORAGE_TYPES = ['column', 'normalized'] as const;

export type NutrientUnit = (typeof NUTRIENT_UNITS)[number];
export type NutrientCategory = (typeof NUTRIENT_CATEGORIES)[number];
export type NutrientStorageType = (typeof NUTRIENT_STORAGE_TYPES)[number];

export interface NutrientCatalogEntry {
  key: string;
  displayName: string;
  category: NutrientCategory;
  defaultUnit: NutrientUnit;
  allowedUnits: readonly NutrientUnit[];
  storage: NutrientStorageType;
  sourceAliases?: readonly string[];
}

function nutrient(
  key: string,
  displayName: string,
  category: NutrientCategory,
  defaultUnit: NutrientUnit,
  storage: NutrientStorageType,
  sourceAliases?: readonly string[],
): NutrientCatalogEntry {
  return {
    key,
    displayName,
    category,
    defaultUnit,
    allowedUnits: [defaultUnit],
    storage,
    ...(sourceAliases === undefined ? {} : { sourceAliases }),
  };
}

export const NUTRIENT_CATALOG = {
  calories: nutrient('calories', 'Calories', 'macro', 'kcal', 'column'),
  protein: nutrient('protein', 'Protein', 'macro', 'g', 'column'),
  carbs: nutrient('carbs', 'Carbohydrates', 'macro', 'g', 'column'),
  fat: nutrient('fat', 'Fat', 'macro', 'g', 'column'),
  fiber: nutrient('fiber', 'Fiber', 'macro', 'g', 'column'),
  sugar: nutrient('sugar', 'Sugar', 'macro', 'g', 'column'),
  sodium: nutrient('sodium', 'Sodium', 'mineral', 'mg', 'column'),

  addedSugar: nutrient(
    'addedSugar',
    'Added Sugar',
    'carbohydrate_detail',
    'g',
    'normalized',
  ),
  starch: nutrient(
    'starch',
    'Starch',
    'carbohydrate_detail',
    'g',
    'normalized',
  ),
  solubleFiber: nutrient(
    'solubleFiber',
    'Soluble Fiber',
    'carbohydrate_detail',
    'g',
    'normalized',
  ),
  insolubleFiber: nutrient(
    'insolubleFiber',
    'Insoluble Fiber',
    'carbohydrate_detail',
    'g',
    'normalized',
  ),
  sugarAlcohol: nutrient(
    'sugarAlcohol',
    'Sugar Alcohol',
    'carbohydrate_detail',
    'g',
    'normalized',
  ),

  saturatedFat: nutrient(
    'saturatedFat',
    'Saturated Fat',
    'fat_subtype',
    'g',
    'normalized',
  ),
  transFat: nutrient('transFat', 'Trans Fat', 'fat_subtype', 'g', 'normalized'),
  monounsaturatedFat: nutrient(
    'monounsaturatedFat',
    'Monounsaturated Fat',
    'fat_subtype',
    'g',
    'normalized',
  ),
  polyunsaturatedFat: nutrient(
    'polyunsaturatedFat',
    'Polyunsaturated Fat',
    'fat_subtype',
    'g',
    'normalized',
  ),
  omega3: nutrient('omega3', 'Omega-3', 'fat_subtype', 'g', 'normalized'),
  omega6: nutrient('omega6', 'Omega-6', 'fat_subtype', 'g', 'normalized'),
  cholesterol: nutrient(
    'cholesterol',
    'Cholesterol',
    'fat_subtype',
    'mg',
    'normalized',
  ),

  histidine: nutrient(
    'histidine',
    'Histidine',
    'amino_acid',
    'g',
    'normalized',
  ),
  isoleucine: nutrient(
    'isoleucine',
    'Isoleucine',
    'amino_acid',
    'g',
    'normalized',
  ),
  leucine: nutrient('leucine', 'Leucine', 'amino_acid', 'g', 'normalized'),
  lysine: nutrient('lysine', 'Lysine', 'amino_acid', 'g', 'normalized'),
  methionine: nutrient(
    'methionine',
    'Methionine',
    'amino_acid',
    'g',
    'normalized',
  ),
  phenylalanine: nutrient(
    'phenylalanine',
    'Phenylalanine',
    'amino_acid',
    'g',
    'normalized',
  ),
  threonine: nutrient(
    'threonine',
    'Threonine',
    'amino_acid',
    'g',
    'normalized',
  ),
  tryptophan: nutrient(
    'tryptophan',
    'Tryptophan',
    'amino_acid',
    'g',
    'normalized',
  ),
  valine: nutrient('valine', 'Valine', 'amino_acid', 'g', 'normalized'),
  alanine: nutrient('alanine', 'Alanine', 'amino_acid', 'g', 'normalized'),
  arginine: nutrient('arginine', 'Arginine', 'amino_acid', 'g', 'normalized'),
  asparticAcid: nutrient(
    'asparticAcid',
    'Aspartic Acid',
    'amino_acid',
    'g',
    'normalized',
  ),
  cystine: nutrient('cystine', 'Cystine', 'amino_acid', 'g', 'normalized'),
  glutamicAcid: nutrient(
    'glutamicAcid',
    'Glutamic Acid',
    'amino_acid',
    'g',
    'normalized',
  ),
  glycine: nutrient('glycine', 'Glycine', 'amino_acid', 'g', 'normalized'),
  proline: nutrient('proline', 'Proline', 'amino_acid', 'g', 'normalized'),
  serine: nutrient('serine', 'Serine', 'amino_acid', 'g', 'normalized'),
  tyrosine: nutrient('tyrosine', 'Tyrosine', 'amino_acid', 'g', 'normalized'),

  potassium: nutrient('potassium', 'Potassium', 'mineral', 'mg', 'normalized'),
  caffeine: nutrient('caffeine', 'Caffeine', 'stimulant', 'mg', 'normalized'),
  alcohol: nutrient('alcohol', 'Alcohol', 'other', 'g', 'normalized'),
  water: nutrient('water', 'Water', 'other', 'g', 'normalized'),
  oxalate: nutrient('oxalate', 'Oxalate', 'other', 'mg', 'normalized'),
  phytate: nutrient('phytate', 'Phytate', 'other', 'mg', 'normalized'),

  vitaminA: nutrient('vitaminA', 'Vitamin A', 'vitamin', 'mcg', 'normalized'),
  thiamine: nutrient('thiamine', 'Thiamine', 'vitamin', 'mg', 'normalized', [
    'vitaminB1',
  ]),
  riboflavin: nutrient(
    'riboflavin',
    'Riboflavin',
    'vitamin',
    'mg',
    'normalized',
    ['vitaminB2'],
  ),
  niacin: nutrient('niacin', 'Niacin', 'vitamin', 'mg', 'normalized', [
    'vitaminB3',
  ]),
  pantothenicAcid: nutrient(
    'pantothenicAcid',
    'Pantothenic Acid',
    'vitamin',
    'mg',
    'normalized',
    ['vitaminB5'],
  ),
  vitaminB6: nutrient('vitaminB6', 'Vitamin B6', 'vitamin', 'mg', 'normalized'),
  biotin: nutrient('biotin', 'Biotin', 'vitamin', 'mcg', 'normalized', [
    'vitaminB7',
  ]),
  folate: nutrient('folate', 'Folate', 'vitamin', 'mcg', 'normalized', [
    'vitaminB9',
  ]),
  vitaminB12: nutrient(
    'vitaminB12',
    'Vitamin B12',
    'vitamin',
    'mcg',
    'normalized',
  ),
  vitaminC: nutrient('vitaminC', 'Vitamin C', 'vitamin', 'mg', 'normalized'),
  vitaminD: nutrient('vitaminD', 'Vitamin D', 'vitamin', 'mcg', 'normalized'),
  vitaminE: nutrient('vitaminE', 'Vitamin E', 'vitamin', 'mg', 'normalized'),
  vitaminK: nutrient('vitaminK', 'Vitamin K', 'vitamin', 'mcg', 'normalized'),

  calcium: nutrient('calcium', 'Calcium', 'mineral', 'mg', 'normalized'),
  iron: nutrient('iron', 'Iron', 'mineral', 'mg', 'normalized'),
  magnesium: nutrient('magnesium', 'Magnesium', 'mineral', 'mg', 'normalized'),
  zinc: nutrient('zinc', 'Zinc', 'mineral', 'mg', 'normalized'),
  phosphorus: nutrient(
    'phosphorus',
    'Phosphorus',
    'mineral',
    'mg',
    'normalized',
  ),
  selenium: nutrient('selenium', 'Selenium', 'mineral', 'mcg', 'normalized'),
  copper: nutrient('copper', 'Copper', 'mineral', 'mg', 'normalized'),
  manganese: nutrient('manganese', 'Manganese', 'mineral', 'mg', 'normalized'),
  iodine: nutrient('iodine', 'Iodine', 'mineral', 'mcg', 'normalized'),
  chromium: nutrient('chromium', 'Chromium', 'mineral', 'mcg', 'normalized'),
  molybdenum: nutrient(
    'molybdenum',
    'Molybdenum',
    'mineral',
    'mcg',
    'normalized',
  ),
  chloride: nutrient('chloride', 'Chloride', 'mineral', 'mg', 'normalized'),
} as const satisfies Record<string, NutrientCatalogEntry>;

export type NutrientKey = keyof typeof NUTRIENT_CATALOG;

export const COLUMN_BACKED_NUTRIENT_KEYS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodium',
] as const;

export const NORMALIZED_NUTRIENT_KEYS = [
  'addedSugar',
  'starch',
  'solubleFiber',
  'insolubleFiber',
  'sugarAlcohol',
  'saturatedFat',
  'transFat',
  'monounsaturatedFat',
  'polyunsaturatedFat',
  'omega3',
  'omega6',
  'cholesterol',
  'histidine',
  'isoleucine',
  'leucine',
  'lysine',
  'methionine',
  'phenylalanine',
  'threonine',
  'tryptophan',
  'valine',
  'alanine',
  'arginine',
  'asparticAcid',
  'cystine',
  'glutamicAcid',
  'glycine',
  'proline',
  'serine',
  'tyrosine',
  'potassium',
  'caffeine',
  'alcohol',
  'water',
  'oxalate',
  'phytate',
  'vitaminA',
  'thiamine',
  'riboflavin',
  'niacin',
  'pantothenicAcid',
  'vitaminB6',
  'biotin',
  'folate',
  'vitaminB12',
  'vitaminC',
  'vitaminD',
  'vitaminE',
  'vitaminK',
  'calcium',
  'iron',
  'magnesium',
  'zinc',
  'phosphorus',
  'selenium',
  'copper',
  'manganese',
  'iodine',
  'chromium',
  'molybdenum',
  'chloride',
] as const;

export const NUTRIENT_KEYS = [
  ...COLUMN_BACKED_NUTRIENT_KEYS,
  ...NORMALIZED_NUTRIENT_KEYS,
] as const;

export type ColumnBackedNutrientKey =
  (typeof COLUMN_BACKED_NUTRIENT_KEYS)[number];
export type NormalizedNutrientKey = (typeof NORMALIZED_NUTRIENT_KEYS)[number];
