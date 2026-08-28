-- National reference identities are unique within a provider release, including
-- archived building rows. This makes interrupted imports resumable without
-- accumulating physical duplicates.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "FoodItem"
    WHERE "sourceProvider" IN ('cnf', 'ciqual', 'cofid')
      AND "sourceId" IS NOT NULL
      AND "datasetRelease" IS NOT NULL
    GROUP BY "sourceProvider", "sourceId", "datasetRelease"
    HAVING COUNT(*) > 1
      AND (
        COUNT(*) FILTER (WHERE "sourceRecordHash" IS NULL) > 0
        OR COUNT(DISTINCT "sourceRecordHash") > 1
      )
  ) THEN
    RAISE EXCEPTION
      'Cannot repair conflicting national release FoodItem duplicates without authoritative hashes';
  END IF;
END $$;

CREATE TEMP TABLE "NationalReleaseDuplicateMap" ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "sourceProvider", "sourceId", "datasetRelease"
      ORDER BY "createdAt", "id"
    ) AS "survivorId",
    ROW_NUMBER() OVER (
      PARTITION BY "sourceProvider", "sourceId", "datasetRelease"
      ORDER BY "createdAt", "id"
    ) AS "duplicateRank"
  FROM "FoodItem"
  WHERE "sourceProvider" IN ('cnf', 'ciqual', 'cofid')
    AND "sourceId" IS NOT NULL
    AND "datasetRelease" IS NOT NULL
)
SELECT "id" AS "duplicateId", "survivorId"
FROM ranked
WHERE "duplicateRank" > 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "FoodLog" AS log
    JOIN "NationalReleaseDuplicateMap" AS duplicate
      ON duplicate."duplicateId" = log."foodItemId"
  ) OR EXISTS (
    SELECT 1
    FROM "FoodBarcode" AS barcode
    JOIN "NationalReleaseDuplicateMap" AS duplicate
      ON duplicate."duplicateId" = barcode."foodItemId"
  ) OR EXISTS (
    SELECT 1
    FROM "SavedFoodItem" AS saved
    JOIN "NationalReleaseDuplicateMap" AS duplicate
      ON duplicate."duplicateId" = saved."foodItemId"
  ) OR EXISTS (
    SELECT 1
    FROM "FoodItemServingPreference" AS preference
    JOIN "NationalReleaseDuplicateMap" AS duplicate
      ON duplicate."duplicateId" = preference."foodItemId"
  ) OR EXISTS (
    SELECT 1
    FROM "RecipeIngredient" AS ingredient
    JOIN "NationalReleaseDuplicateMap" AS duplicate
      ON duplicate."duplicateId" = ingredient."foodItemId"
  ) THEN
    RAISE EXCEPTION
      'Cannot repair national release FoodItem duplicates with dependent domain records';
  END IF;
END $$;

-- Equivalent duplicate rows keep one deterministic FoodItem. Nutrient rows are
-- merged first so the existing FoodItemNutrient uniqueness remains valid. The
-- row-number pass handles three or more duplicate foods and overlapping
-- nutrient keys, not only the common two-row case.
CREATE TEMP TABLE "NationalReleaseNutrientMap" ON COMMIT DROP AS
SELECT
  nutrient."id" AS "nutrientId",
  COALESCE(duplicate."survivorId", nutrient."foodItemId") AS "survivorId",
  ROW_NUMBER() OVER (
    PARTITION BY
      COALESCE(duplicate."survivorId", nutrient."foodItemId"),
      nutrient."nutrientKey"
    ORDER BY
      CASE WHEN duplicate."survivorId" IS NULL THEN 0 ELSE 1 END,
      nutrient."foodItemId",
      nutrient."id"
  ) AS "nutrientRank"
FROM "FoodItemNutrient" AS nutrient
LEFT JOIN "NationalReleaseDuplicateMap" AS duplicate
  ON duplicate."duplicateId" = nutrient."foodItemId";

DELETE FROM "FoodItemNutrient" AS nutrient
USING "NationalReleaseNutrientMap" AS mapped
WHERE mapped."nutrientId" = nutrient."id"
  AND mapped."nutrientRank" > 1;

UPDATE "FoodItemNutrient" AS nutrient
SET "foodItemId" = mapped."survivorId"
FROM "NationalReleaseNutrientMap" AS mapped
WHERE mapped."nutrientId" = nutrient."id"
  AND mapped."nutrientRank" = 1
  AND nutrient."foodItemId" <> mapped."survivorId";

DELETE FROM "FoodItem" AS duplicate_food
USING "NationalReleaseDuplicateMap" AS duplicate
WHERE duplicate_food."id" = duplicate."duplicateId";

CREATE UNIQUE INDEX "FoodItem_national_provider_source_release_unique"
  ON "FoodItem"("sourceProvider", "sourceId", "datasetRelease")
  WHERE "sourceProvider" IN ('cnf', 'ciqual', 'cofid')
    AND "sourceId" IS NOT NULL
    AND "datasetRelease" IS NOT NULL;
