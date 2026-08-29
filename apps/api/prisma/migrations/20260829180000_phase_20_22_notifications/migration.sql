CREATE TYPE "NotificationClass" AS ENUM ('recommendation_insight', 'logging_reminder');
CREATE TYPE "NotificationEventStatus" AS ENUM ('claimed', 'submitted', 'completed', 'failed', 'receipt_expired');
CREATE TYPE "NotificationPlatform" AS ENUM ('ios', 'android');

CREATE TABLE "NotificationPreference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "recommendationInsightsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "loggingRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationInstallation" (
  "id" UUID NOT NULL,
  "installationId" TEXT NOT NULL,
  "userId" UUID,
  "expoPushToken" TEXT,
  "tokenHash" TEXT,
  "platform" "NotificationPlatform" NOT NULL,
  "enabledAt" TIMESTAMPTZ,
  "disabledAt" TIMESTAMPTZ,
  "lastRegisteredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "NotificationInstallation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationInstallation_installationId_key" ON "NotificationInstallation"("installationId");
CREATE UNIQUE INDEX "NotificationInstallation_tokenHash_key" ON "NotificationInstallation"("tokenHash");
CREATE INDEX "NotificationInstallation_userId_disabledAt_idx" ON "NotificationInstallation"("userId", "disabledAt");
ALTER TABLE "NotificationInstallation" ADD CONSTRAINT "NotificationInstallation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NotificationEvent" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "class" "NotificationClass" NOT NULL,
  "localDate" DATE NOT NULL,
  "identityKey" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "recommendationId" UUID,
  "status" "NotificationEventStatus" NOT NULL DEFAULT 'claimed',
  "claimedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");
CREATE UNIQUE INDEX "NotificationEvent_userId_localDate_key" ON "NotificationEvent"("userId", "localDate");
CREATE INDEX "NotificationEvent_userId_claimedAt_idx" ON "NotificationEvent"("userId", "claimedAt");
CREATE INDEX "NotificationEvent_userId_class_claimedAt_idx" ON "NotificationEvent"("userId", "class", "claimedAt");
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_recommendationId_fkey"
  FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NotificationDeliveryAttempt" (
  "id" UUID NOT NULL,
  "notificationEventId" UUID NOT NULL,
  "notificationInstallationId" UUID,
  "tokenHash" TEXT NOT NULL,
  "expoTicketId" TEXT,
  "status" "NotificationEventStatus" NOT NULL DEFAULT 'submitted',
  "attemptedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMPTZ,
  "receiptCheckCount" INTEGER NOT NULL DEFAULT 0,
  "nextReceiptCheckAt" TIMESTAMPTZ,
  "receiptLastCheckedAt" TIMESTAMPTZ,
  "receiptStatus" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_expoTicketId_key" ON "NotificationDeliveryAttempt"("expoTicketId");
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_event_installation_token_key"
  ON "NotificationDeliveryAttempt"("notificationEventId", "notificationInstallationId", "tokenHash");
CREATE INDEX "NotificationDeliveryAttempt_nextReceiptCheckAt_status_idx"
  ON "NotificationDeliveryAttempt"("nextReceiptCheckAt", "status");
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_event_fkey"
  FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_installation_fkey"
  FOREIGN KEY ("notificationInstallationId") REFERENCES "NotificationInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NotificationWorkerCheckpoint" (
  "key" TEXT NOT NULL,
  "cursorUserId" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "NotificationWorkerCheckpoint_pkey" PRIMARY KEY ("key")
);
