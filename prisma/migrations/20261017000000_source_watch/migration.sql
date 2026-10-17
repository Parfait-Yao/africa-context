-- AlterTable
ALTER TABLE "Context" ADD COLUMN     "sourceCheckFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceCheckedAt" TIMESTAMP(3);
