ALTER TABLE "UserGoal"
ADD COLUMN "targetCarbsGrams" DECIMAL(6,1),
ADD COLUMN "targetFatGrams" DECIMAL(6,1),
ADD COLUMN "targetFiberGrams" DECIMAL(6,1),
ADD COLUMN "limitSugarGrams" DECIMAL(6,1),
ADD COLUMN "limitSodiumMg" INTEGER;
