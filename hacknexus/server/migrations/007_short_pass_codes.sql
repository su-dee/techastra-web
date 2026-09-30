BEGIN;
-- Check-in codes are now 8 characters. CHAR(32) would pad them with spaces;
-- converting keeps existing 32-character codes unchanged and valid.
ALTER TABLE registrations ALTER COLUMN pass_code TYPE VARCHAR(32);
COMMIT;
