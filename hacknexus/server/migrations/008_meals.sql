BEGIN;
-- Food counter: each squad collects each meal once (ids in server/meals.js).
CREATE TABLE IF NOT EXISTS meal_handouts (
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  meal VARCHAR(20) NOT NULL,
  people SMALLINT NOT NULL CHECK (people BETWEEN 1 AND 4),
  given_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  given_by VARCHAR(30),
  PRIMARY KEY (registration_id, meal)
);
CREATE INDEX IF NOT EXISTS meal_handouts_meal_idx ON meal_handouts(meal, given_at DESC);
COMMIT;
