-- CreateTable
CREATE TABLE "AccountDeletion" (
    "id" UUID NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "applicationUserId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AccountDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletion_firebaseUid_key" ON "AccountDeletion"("firebaseUid");
