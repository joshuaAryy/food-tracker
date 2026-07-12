-- AlterTable
ALTER TABLE "FoodItem" ADD COLUMN "servingOptions" JSONB;

-- AlterTable
ALTER TABLE "FoodLog" ADD COLUMN "servingSnapshot" JSONB;
