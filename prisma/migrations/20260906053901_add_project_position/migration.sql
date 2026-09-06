-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT,
    "galleryJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "externalLinksJson" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "featuredOnResume" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("commentCount", "completedAt", "coverImageUrl", "createdAt", "description", "externalLinksJson", "featuredOnResume", "galleryJson", "id", "likeCount", "ownerId", "slug", "startedAt", "status", "summary", "title", "updatedAt", "visibility") SELECT "commentCount", "completedAt", "coverImageUrl", "createdAt", "description", "externalLinksJson", "featuredOnResume", "galleryJson", "id", "likeCount", "ownerId", "slug", "startedAt", "status", "summary", "title", "updatedAt", "visibility" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_ownerId_position_idx" ON "Project"("ownerId", "position");
CREATE INDEX "Project_visibility_createdAt_idx" ON "Project"("visibility", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
