-- Phase 20–22: numeric planning rate and preserved target override provenance.

CREATE TYPE "TargetOverrideOrigin" AS ENUM ('user', 'legacy_preserved');

ALTER TABLE "UserGoal" ADD COLUMN "targetRateLbPerWeek" DECIMAL(3,2);

CREATE TABLE "UserNutrientTargetOverride" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "nutrientKey" "NutrientKey" NOT NULL,
  "value" DECIMAL(12,4) NOT NULL,
  "origin" "TargetOverrideOrigin" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "UserNutrientTargetOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserNutrientTargetOverride_userId_nutrientKey_key"
  ON "UserNutrientTargetOverride"("userId", "nutrientKey");
CREATE INDEX "UserNutrientTargetOverride_userId_idx"
  ON "UserNutrientTargetOverride"("userId");
ALTER TABLE "UserNutrientTargetOverride"
  ADD CONSTRAINT "UserNutrientTargetOverride_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing target columns have unknown provenance. Preserve them as explicit
-- overrides rather than guessing onboarding versus later manual entry.
INSERT INTO "UserNutrientTargetOverride" ("id", "userId", "nutrientKey", "value", "origin", "updatedAt")
SELECT gen_random_uuid(), "userId", 'calories'::"NutrientKey", "targetCalories", 'legacy_preserved'::"TargetOverrideOrigin", CURRENT_TIMESTAMP
FROM "UserGoal" WHERE "targetCalories" IS NOT NULL
UNION ALL
SELECT gen_random_uuid(), "userId", 'protein'::"NutrientKey", "targetProteinGrams", 'legacy_preserved'::"TargetOverrideOrigin", CURRENT_TIMESTAMP
FROM "UserGoal" WHERE "targetProteinGrams" IS NOT NULL
UNION ALL
SELECT gen_random_uuid(), "userId", 'carbs'::"NutrientKey", "targetCarbsGrams", 'legacy_preserved'::"TargetOverrideOrigin", CURRENT_TIMESTAMP
FROM "UserGoal" WHERE "targetCarbsGrams" IS NOT NULL
UNION ALL
SELECT gen_random_uuid(), "userId", 'fat'::"NutrientKey", "targetFatGrams", 'legacy_preserved'::"TargetOverrideOrigin", CURRENT_TIMESTAMP
FROM "UserGoal" WHERE "targetFatGrams" IS NOT NULL
UNION ALL
SELECT gen_random_uuid(), "userId", 'fiber'::"NutrientKey", "targetFiberGrams", 'legacy_preserved'::"TargetOverrideOrigin", CURRENT_TIMESTAMP
FROM "UserGoal" WHERE "targetFiberGrams" IS NOT NULL
UNION ALL
SELECT gen_random_uuid(), "userId", 'sugar'::"NutrientKey", "limitSugarGrams", 'legacy_preserved'::"TargetOverrideOrigin", CURRENT_TIMESTAMP
FROM "UserGoal" WHERE "limitSugarGrams" IS NOT NULL
UNION ALL
SELECT gen_random_uuid(), "userId", 'sodium'::"NutrientKey", "limitSodiumMg", 'legacy_preserved'::"TargetOverrideOrigin", CURRENT_TIMESTAMP
FROM "UserGoal" WHERE "limitSodiumMg" IS NOT NULL;
