BEGIN;
-- Participation certificates: the prefix printed before each member's name
-- ("Mr" / "Ms", "" = none), and when a squad's certificates were emailed to
-- its lead (so a re-send skips it).
ALTER TABLE registration_members ADD COLUMN IF NOT EXISTS title VARCHAR(2) NOT NULL DEFAULT '';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS certificates_emailed_at TIMESTAMPTZ;
COMMIT;
