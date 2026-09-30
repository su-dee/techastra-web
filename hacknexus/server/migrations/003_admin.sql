BEGIN;
-- Organizer accounts use a separate strong password, never the mobile-number credential.
CREATE TABLE IF NOT EXISTS admins (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin sessions use their own cookie and a shorter lifetime.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'pending';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS admin_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_status_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('pending', 'approved', 'waitlisted', 'rejected'));
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_admin_notes_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_admin_notes_check
  CHECK (char_length(admin_notes) <= 2000);
CREATE INDEX IF NOT EXISTS registrations_status_idx ON registrations(status);
CREATE INDEX IF NOT EXISTS registrations_created_at_idx ON registrations(created_at);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_username VARCHAR(30) NOT NULL,
  action VARCHAR(40) NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log(created_at DESC);
COMMIT;
