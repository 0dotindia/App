-- CreateTable
CREATE TABLE "PasswordRecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "emailVerifiedAt" DATETIME,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dateOfBirth" DATETIME,
    "ageVerifiedAt" DATETIME,
    "dmcaStrikeCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "twoFactorSecret" TEXT,
    "twoFactorEnabledAt" DATETIME,
    "locale" TEXT,
    "timezone" TEXT,
    "deletionScheduledFor" DATETIME,
    "accessibilityPrefsJson" TEXT,
    "stripeCustomerId" TEXT,
    "referredByUserId" TEXT,
    CONSTRAINT "User_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("accessibilityPrefsJson", "ageVerifiedAt", "createdAt", "dateOfBirth", "deletionScheduledFor", "dmcaStrikeCount", "email", "emailVerifiedAt", "id", "lastActiveAt", "locale", "passwordHash", "phone", "referredByUserId", "status", "stripeCustomerId", "timezone", "twoFactorEnabledAt", "twoFactorSecret", "updatedAt") SELECT "accessibilityPrefsJson", "ageVerifiedAt", "createdAt", "dateOfBirth", "deletionScheduledFor", "dmcaStrikeCount", "email", "emailVerifiedAt", "id", "lastActiveAt", "locale", "passwordHash", "phone", "referredByUserId", "status", "stripeCustomerId", "timezone", "twoFactorEnabledAt", "twoFactorSecret", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PasswordRecoveryCode_codeHash_key" ON "PasswordRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "PasswordRecoveryCode_userId_idx" ON "PasswordRecoveryCode"("userId");
