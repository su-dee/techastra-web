BEGIN;
-- Squad member details. Position 1 is the squad lead, whose email is the
-- registration's lead_email. Rows are replaced as a set when the lead edits them.
CREATE TABLE IF NOT EXISTS registration_members (
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 4),
  full_name VARCHAR(80) NOT NULL CHECK (char_length(btrim(full_name)) >= 2),
  email VARCHAR(254) NOT NULL,
  phone CHAR(10) NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  college VARCHAR(120) NOT NULL CHECK (char_length(btrim(college)) >= 2),
  PRIMARY KEY (registration_id, position)
);
COMMIT;
