-- Audit trail: who reviewed (approved / rejected / overrode) a registration, and when.
ALTER TABLE "Registration" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Registration" ADD COLUMN "reviewedByName" TEXT;
ALTER TABLE "Registration" ADD COLUMN "reviewedAt" TIMESTAMP(3);
