CREATE TABLE "AnalyticsSavedView" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "primaryMetric" TEXT NOT NULL,
  "comparisonMetric" TEXT,
  "periodDays" INTEGER NOT NULL,
  "aggregation" TEXT NOT NULL,
  "visualization" TEXT NOT NULL,
  "showReference" BOOLEAN NOT NULL DEFAULT true,
  "coverageFilter" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "AnalyticsSavedView_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AnalyticsPreference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "preferredSimpleMetric" TEXT NOT NULL DEFAULT 'calories',
  "pinnedSavedViewId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "AnalyticsPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsPreference_userId_key" ON "AnalyticsPreference"("userId");
CREATE INDEX "AnalyticsSavedView_userId_idx" ON "AnalyticsSavedView"("userId");
CREATE INDEX "AnalyticsSavedView_userId_sortOrder_idx" ON "AnalyticsSavedView"("userId", "sortOrder");
ALTER TABLE "AnalyticsSavedView" ADD CONSTRAINT "AnalyticsSavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsPreference" ADD CONSTRAINT "AnalyticsPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
