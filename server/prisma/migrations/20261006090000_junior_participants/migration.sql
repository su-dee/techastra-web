-- Junior Techastra students imported by the Junior coordinator (Excel/CSV):
-- no account, contact details, ID card, QR check-in or certificate.
CREATE TABLE "JuniorParticipant" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "teamName" TEXT,
    "importedById" TEXT NOT NULL,
    "importedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JuniorParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JuniorParticipant_code_key" ON "JuniorParticipant"("code");
CREATE INDEX "JuniorParticipant_eventId_idx" ON "JuniorParticipant"("eventId");
