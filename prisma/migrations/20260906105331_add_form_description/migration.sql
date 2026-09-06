-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Form" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerType" TEXT NOT NULL,
    "ownerProfileId" TEXT,
    "ownerBusinessId" TEXT,
    "ownerOrganizationId" TEXT,
    "ownerCommunityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "fieldsJson" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'form',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Form_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Form_ownerBusinessId_fkey" FOREIGN KEY ("ownerBusinessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Form_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Form_ownerCommunityId_fkey" FOREIGN KEY ("ownerCommunityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Form" ("createdAt", "fieldsJson", "id", "mode", "ownerBusinessId", "ownerCommunityId", "ownerOrganizationId", "ownerProfileId", "ownerType", "status", "title") SELECT "createdAt", "fieldsJson", "id", "mode", "ownerBusinessId", "ownerCommunityId", "ownerOrganizationId", "ownerProfileId", "ownerType", "status", "title" FROM "Form";
DROP TABLE "Form";
ALTER TABLE "new_Form" RENAME TO "Form";
CREATE INDEX "Form_ownerProfileId_idx" ON "Form"("ownerProfileId");
CREATE INDEX "Form_ownerBusinessId_idx" ON "Form"("ownerBusinessId");
CREATE INDEX "Form_ownerOrganizationId_idx" ON "Form"("ownerOrganizationId");
CREATE INDEX "Form_ownerCommunityId_idx" ON "Form"("ownerCommunityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
