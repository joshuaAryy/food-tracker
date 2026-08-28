-- Phase 18/19: nutrient provenance and derived search-index lifecycle.
ALTER TABLE "FoodItemNutrient"
  ADD COLUMN "sourceProvider" "FoodSourceProvider",
  ADD COLUMN "sourceRecordId" TEXT,
  ADD COLUMN "sourceRelease" TEXT;

CREATE INDEX "FoodItemNutrient_sourceProvider_sourceRelease_idx"
  ON "FoodItemNutrient"("sourceProvider", "sourceRelease");

CREATE TABLE "FoodSearchIndexVersion" (
  "id" UUID NOT NULL,
  "indexVersion" TEXT NOT NULL,
  "namespace" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "documentFormat" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "documentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMPTZ,
  "retiredAt" TIMESTAMPTZ,
  CONSTRAINT "FoodSearchIndexVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodSearchIndexVersion_indexVersion_namespace_key"
  ON "FoodSearchIndexVersion"("indexVersion", "namespace");
CREATE INDEX "FoodSearchIndexVersion_status_activatedAt_idx"
  ON "FoodSearchIndexVersion"("status", "activatedAt");
