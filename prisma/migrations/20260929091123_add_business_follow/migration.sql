-- CreateTable
CREATE TABLE "BusinessFollow" (
    "followerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("followerId", "businessId"),
    CONSTRAINT "BusinessFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessFollow_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "category" TEXT NOT NULL,
    "foundedYear" INTEGER,
    "sizeRange" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "averageRating" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Business_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Business" ("averageRating", "category", "coverUrl", "createdAt", "createdBy", "description", "foundedYear", "id", "isVerified", "logoUrl", "name", "reviewCount", "sizeRange", "slug", "status", "tagline", "updatedAt") SELECT "averageRating", "category", "coverUrl", "createdAt", "createdBy", "description", "foundedYear", "id", "isVerified", "logoUrl", "name", "reviewCount", "sizeRange", "slug", "status", "tagline", "updatedAt" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_status_idx" ON "Business"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BusinessFollow_businessId_createdAt_idx" ON "BusinessFollow"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessFollow_followerId_createdAt_idx" ON "BusinessFollow"("followerId", "createdAt");
