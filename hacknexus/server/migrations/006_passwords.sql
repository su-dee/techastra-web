BEGIN;
-- What the stored password hash is: a password the user chose, the mobile
-- number used as the password before chosen passwords existed, or a temporary
-- password an organizer issued. Existing accounts are mobile-number accounts;
-- new accounts choose a password.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_kind VARCHAR(10) NOT NULL DEFAULT 'mobile';
ALTER TABLE users ALTER COLUMN password_kind SET DEFAULT 'chosen';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_kind_check;
ALTER TABLE users ADD CONSTRAINT users_password_kind_check CHECK (password_kind IN ('chosen', 'mobile', 'temporary'));
COMMIT;
