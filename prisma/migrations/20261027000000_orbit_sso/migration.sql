-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "orbitCheckedAt" TIMESTAMP(3),
ADD COLUMN     "orbitSid" TEXT;

-- CreateIndex
CREATE INDEX "Session_orbitSid_idx" ON "Session"("orbitSid");
