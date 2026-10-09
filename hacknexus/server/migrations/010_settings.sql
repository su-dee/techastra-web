BEGIN;
-- Site-wide switches set by the organisers, e.g. certificates_released
-- (participation certificates shown on squad dashboards).
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(40) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(30)
);
COMMIT;
