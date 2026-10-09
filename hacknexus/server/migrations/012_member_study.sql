BEGIN;
-- Year of study and department per member, for the valedictory winners
-- sheet (set by the organisers; registration never asked for them).
ALTER TABLE registration_members ADD COLUMN IF NOT EXISTS year_of_study VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE registration_members ADD COLUMN IF NOT EXISTS department VARCHAR(80) NOT NULL DEFAULT '';
COMMIT;
