-- CreateEnum
CREATE TYPE "FoodItemSourceType" AS ENUM ('user_custom', 'cached_external', 'app_owned');

-- CreateEnum
CREATE TYPE "FoodItemType" AS ENUM ('generic', 'branded');

-- CreateEnum
CREATE TYPE "FoodSourceProvider" AS ENUM ('open_food_facts', 'usda_fdc', 'manual', 'other');

-- AlterTable
ALTER TABLE "FoodLog" ADD COLUMN "foodItemId" UUID;

-- CreateTable
CREATE TABLE "FoodItem" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "sourceType" "FoodItemSourceType" NOT NULL,
    "foodType" "FoodItemType" NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "normalizedBrandName" TEXT,
    "searchText" TEXT NOT NULL,
    "servingQuantity" DECIMAL(8,2),
    "servingUnit" TEXT,
    "servingWeightGrams" DECIMAL(8,2),
    "calories" INTEGER,
    "protein" DECIMAL(6,1),
    "carbs" DECIMAL(6,1),
    "fat" DECIMAL(6,1),
    "fiber" DECIMAL(6,1),
    "sugar" DECIMAL(6,1),
    "sodium" INTEGER,
    "additionalNutrients" JSONB,
    "sourceProvider" "FoodSourceProvider",
    "sourceId" TEXT,
    "sourceUpdatedAt" TIMESTAMPTZ,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodBarcode" (
    "id" UUID NOT NULL,
    "foodItemId" UUID NOT NULL,
    "barcode" TEXT NOT NULL,
    "barcodeFormat" TEXT,
    "regionCode" TEXT NOT NULL DEFAULT 'GLOBAL',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FoodBarcode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFoodItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "foodItemId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodLog_foodItemId_idx" ON "FoodLog"("foodItemId");

-- CreateIndex
CREATE INDEX "FoodItem_userId_idx" ON "FoodItem"("userId");

-- CreateIndex
CREATE INDEX "FoodItem_sourceType_idx" ON "FoodItem"("sourceType");

-- CreateIndex
CREATE INDEX "FoodItem_foodType_idx" ON "FoodItem"("foodType");

-- CreateIndex
CREATE INDEX "FoodItem_archivedAt_idx" ON "FoodItem"("archivedAt");

-- CreateIndex
CREATE INDEX "FoodItem_normalizedName_idx" ON "FoodItem"("normalizedName");

-- CreateIndex
CREATE INDEX "FoodItem_normalizedBrandName_idx" ON "FoodItem"("normalizedBrandName");

-- CreateIndex
CREATE UNIQUE INDEX "FoodBarcode_barcode_regionCode_key" ON "FoodBarcode"("barcode", "regionCode");

-- CreateIndex
CREATE INDEX "FoodBarcode_barcode_idx" ON "FoodBarcode"("barcode");

-- CreateIndex
CREATE INDEX "FoodBarcode_foodItemId_idx" ON "FoodBarcode"("foodItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFoodItem_userId_foodItemId_key" ON "SavedFoodItem"("userId", "foodItemId");

-- CreateIndex
CREATE INDEX "SavedFoodItem_userId_idx" ON "SavedFoodItem"("userId");

-- CreateIndex
CREATE INDEX "SavedFoodItem_foodItemId_idx" ON "SavedFoodItem"("foodItemId");

-- AddForeignKey
ALTER TABLE "FoodLog" ADD CONSTRAINT "FoodLog_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodBarcode" ADD CONSTRAINT "FoodBarcode_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFoodItem" ADD CONSTRAINT "SavedFoodItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFoodItem" ADD CONSTRAINT "SavedFoodItem_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
