BEGIN;
-- Hack Nexus winners (1st-3rd), set by the organisers. Winning squads get no
-- participation certificate.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS winner_position SMALLINT;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_winner_position_idx
  ON registrations(winner_position) WHERE winner_position IS NOT NULL;
COMMIT;
