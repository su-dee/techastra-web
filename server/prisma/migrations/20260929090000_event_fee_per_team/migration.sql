-- Fees are per person (x team size) unless the event charges a flat fee per team.
ALTER TABLE "Event" ADD COLUMN "feePerTeam" BOOLEAN NOT NULL DEFAULT false;
