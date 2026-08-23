-- Phase 18/19: trusted reference provenance and trigram retrieval foundation.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "FoodItemRankingClass" AS ENUM ('app_curated', 'reference', 'user_priority', 'cached_external');

ALTER TYPE "FoodSourceProvider" ADD VALUE IF NOT EXISTS 'cnf';
ALTER TYPE "FoodSourceProvider" ADD VALUE IF NOT EXISTS 'ciqual';
ALTER TYPE "FoodSourceProvider" ADD VALUE IF NOT EXISTS 'cofid';

ALTER TABLE "FoodItem"
  ADD COLUMN "sourceAliases" JSONB,
  ADD COLUMN "sourceRegion" TEXT,
  ADD COLUMN "rankingClass" "FoodItemRankingClass" NOT NULL DEFAULT 'app_curated',
  ADD COLUMN "datasetRelease" TEXT,
  ADD COLUMN "sourceRecordHash" TEXT;

UPDATE "FoodItem"
SET "rankingClass" = CASE
  WHEN "sourceType" = 'cached_external' THEN 'cached_external'::"FoodItemRankingClass"
  WHEN "userId" IS NOT NULL OR "sourceType" = 'user_custom' THEN 'user_priority'::"FoodItemRankingClass"
  ELSE 'app_curated'::"FoodItemRankingClass"
END;

CREATE INDEX "FoodItem_sourceProvider_sourceId_idx" ON "FoodItem"("sourceProvider", "sourceId");
CREATE INDEX "FoodItem_datasetRelease_idx" ON "FoodItem"("datasetRelease");
CREATE UNIQUE INDEX "FoodItem_provider_source_unique"
  ON "FoodItem"("sourceProvider", "sourceId")
  WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL;
CREATE INDEX "FoodItem_searchText_trgm_idx" ON "FoodItem" USING GIST ("searchText" gist_trgm_ops);

CREATE TABLE "FoodDatasetRelease" (
  "id" UUID NOT NULL,
  "provider" "FoodSourceProvider" NOT NULL,
  "release" TEXT NOT NULL,
  "sourceUri" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "FoodDatasetRelease_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FoodDatasetRelease_provider_release_key" ON "FoodDatasetRelease"("provider", "release");
CREATE INDEX "FoodDatasetRelease_provider_status_idx" ON "FoodDatasetRelease"("provider", "status");
