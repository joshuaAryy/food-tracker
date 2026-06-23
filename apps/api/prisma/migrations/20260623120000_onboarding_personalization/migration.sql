-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete');

-- CreateEnum
CREATE TYPE "TrainingStyle" AS ENUM ('none', 'cardio', 'weight_training', 'mixed', 'athlete');

-- CreateEnum
CREATE TYPE "GoalPace" AS ENUM ('slow', 'moderate', 'aggressive', 'lean_bulk', 'moderate_bulk', 'aggressive_bulk');

-- AlterTable
ALTER TABLE "UserProfile"
ADD COLUMN "name" TEXT,
ADD COLUMN "birthDate" DATE,
ADD COLUMN "activityLevel" "ActivityLevel",
ADD COLUMN "trainingStyle" "TrainingStyle";

-- AlterTable
ALTER TABLE "UserGoal"
ADD COLUMN "goalPace" "GoalPace";
