-- AlterTable
ALTER TABLE "TrackingPreference" ADD COLUMN "dailyWaterGoalMl" INTEGER NOT NULL DEFAULT 2000;

-- CreateTable
CREATE TABLE "WaterLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "loggedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WaterLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaterLog_userId_idx" ON "WaterLog"("userId");
CREATE INDEX "WaterLog_userId_loggedAt_idx" ON "WaterLog"("userId", "loggedAt");

-- AddForeignKey
ALTER TABLE "WaterLog" ADD CONSTRAINT "WaterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
