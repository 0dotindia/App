-- AlterTable
ALTER TABLE "MembershipSubscription" ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlatformSubscription" ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false;
