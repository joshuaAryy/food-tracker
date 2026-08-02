ALTER TABLE "User"
ADD COLUMN "firebaseUid" TEXT,
ADD COLUMN "firebaseDisplayName" TEXT,
ADD COLUMN "firebasePhotoUrl" TEXT,
ADD COLUMN "firebaseProviderIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
