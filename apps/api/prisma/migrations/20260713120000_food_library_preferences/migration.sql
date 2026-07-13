ALTER TABLE "FoodItem" ADD COLUMN "derivedFromFoodLogId" UUID;

ALTER TABLE "FoodItem"
  ADD CONSTRAINT "FoodItem_derivedFromFoodLogId_fkey"
  FOREIGN KEY ("derivedFromFoodLogId") REFERENCES "FoodLog"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "FoodItem_derivedFromFoodLogId_key"
  ON "FoodItem"("derivedFromFoodLogId");

CREATE TABLE "FoodItemServingPreference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "foodItemId" UUID NOT NULL,
  "defaultServingQuantity" DECIMAL(8,2) NOT NULL,
  "defaultServingUnit" TEXT NOT NULL,
  "defaultServingOptionId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "FoodItemServingPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FoodItemServingPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FoodItemServingPreference_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FoodItemServingPreference_userId_foodItemId_key"
  ON "FoodItemServingPreference"("userId", "foodItemId");
CREATE INDEX "FoodItemServingPreference_userId_idx" ON "FoodItemServingPreference"("userId");
CREATE INDEX "FoodItemServingPreference_foodItemId_idx" ON "FoodItemServingPreference"("foodItemId");
