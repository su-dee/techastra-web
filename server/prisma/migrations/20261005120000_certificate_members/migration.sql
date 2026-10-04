-- One certificate per person (each team member), the name printed on it,
-- and when a participation certificate was emailed.
ALTER TABLE "Certificate" ADD COLUMN "memberIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Certificate" ADD COLUMN "recipientName" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "emailedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Certificate_registrationId_eventId_type_memberIndex_key" ON "Certificate"("registrationId", "eventId", "type", "memberIndex");
