ALTER TABLE "Recommendation"
  ADD COLUMN "identityKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "conditionFingerprint" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "dismissedAt" TIMESTAMPTZ,
  ADD COLUMN "resolvedAt" TIMESTAMPTZ;

UPDATE "Recommendation" SET "identityKey" = "type" WHERE "identityKey" = '';
UPDATE "Recommendation" SET "conditionFingerprint" = md5("type" || ':' || "id") WHERE "conditionFingerprint" = '';

CREATE INDEX "Recommendation_userId_identityKey_idx"
  ON "Recommendation"("userId", "identityKey");
CREATE UNIQUE INDEX "Recommendation_active_identity_key"
  ON "Recommendation"("userId", "identityKey")
  WHERE "status" = 'active';
