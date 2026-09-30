BEGIN;
-- Admin roles: full admins manage everything; scanners can only check squads in.
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'admin';
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check CHECK (role IN ('admin', 'scanner'));
ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by VARCHAR(30);

-- One payment submission per squad. A rejected submission is replaced on resubmission.
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  transaction_id VARCHAR(40) NOT NULL,
  screenshot BYTEA NOT NULL,
  screenshot_type VARCHAR(20) NOT NULL CHECK (screenshot_type IN ('image/png', 'image/jpeg', 'image/webp')),
  status VARCHAR(10) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected')),
  rejection_reason TEXT NOT NULL DEFAULT '' CHECK (char_length(rejection_reason) <= 500),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(30)
);
-- A UPI transaction ID can only be claimed by one squad.
CREATE UNIQUE INDEX IF NOT EXISTS payments_transaction_id_idx ON payments (UPPER(transaction_id));
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);

-- The ID card QR carries this unguessable code; it is issued when payment is verified.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS pass_code CHAR(32);
CREATE UNIQUE INDEX IF NOT EXISTS registrations_pass_code_idx ON registrations(pass_code);
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS checked_in_by VARCHAR(30);
COMMIT;
