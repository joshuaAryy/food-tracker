-- CreateEnum
CREATE TYPE "NutrientKey" AS ENUM (
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodium',
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
  'chloride'
);

-- CreateEnum
CREATE TYPE "NutrientUnit" AS ENUM ('kcal', 'g', 'mg', 'mcg');

-- CreateTable
CREATE TABLE "FoodItemNutrient" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "foodItemId" UUID NOT NULL,
  "nutrientKey" "NutrientKey" NOT NULL,
  "amount" DECIMAL(12,4) NOT NULL,
  "unit" "NutrientUnit" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "FoodItemNutrient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodLogNutrient" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "foodLogId" UUID NOT NULL,
  "nutrientKey" "NutrientKey" NOT NULL,
  "amount" DECIMAL(12,4) NOT NULL,
  "unit" "NutrientUnit" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "FoodLogNutrient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodItemNutrient_foodItemId_nutrientKey_key" ON "FoodItemNutrient"("foodItemId", "nutrientKey");

-- CreateIndex
CREATE INDEX "FoodItemNutrient_foodItemId_idx" ON "FoodItemNutrient"("foodItemId");

-- CreateIndex
CREATE INDEX "FoodItemNutrient_nutrientKey_idx" ON "FoodItemNutrient"("nutrientKey");

-- CreateIndex
CREATE UNIQUE INDEX "FoodLogNutrient_foodLogId_nutrientKey_key" ON "FoodLogNutrient"("foodLogId", "nutrientKey");

-- CreateIndex
CREATE INDEX "FoodLogNutrient_foodLogId_idx" ON "FoodLogNutrient"("foodLogId");

-- CreateIndex
CREATE INDEX "FoodLogNutrient_nutrientKey_idx" ON "FoodLogNutrient"("nutrientKey");

-- AddForeignKey
ALTER TABLE "FoodItemNutrient" ADD CONSTRAINT "FoodItemNutrient_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLogNutrient" ADD CONSTRAINT "FoodLogNutrient_foodLogId_fkey" FOREIGN KEY ("foodLogId") REFERENCES "FoodLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

