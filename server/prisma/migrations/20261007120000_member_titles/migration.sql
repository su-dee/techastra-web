-- Mr/Ms for each person on the certificates (picked on the dashboard).
ALTER TABLE "Registration" ADD COLUMN "memberTitles" TEXT[] DEFAULT ARRAY[]::TEXT[];
