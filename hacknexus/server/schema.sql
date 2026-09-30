CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,30}$'),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  team_name VARCHAR(30) NOT NULL CHECK (char_length(team_name) BETWEEN 3 AND 30),
  lead_email VARCHAR(254) NOT NULL,
  domain VARCHAR(10) CHECK (domain IN ('HN-AI', 'HN-CS', 'HN-FT', 'HN-X')),
  squad_size SMALLINT NOT NULL CHECK (squad_size BETWEEN 2 AND 4),
  problem_id VARCHAR(20),
  abstract TEXT NOT NULL DEFAULT '' CHECK (char_length(abstract) <= 3000),
  conduct_accepted BOOLEAN NOT NULL CHECK (conduct_accepted = TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT registrations_problem_domain_check CHECK (problem_id IS NULL OR (domain IS NOT NULL AND (
    (domain='HN-AI' AND problem_id IN ('HN-AI-01','HN-AI-02','HN-AI-06','HN-AI-05')) OR
    (domain='HN-CS' AND problem_id IN ('HN-CS-01','HN-CS-02','HN-CS-03','HN-CS-04','HN-CS-05','HN-CS-06','HN-CS-07')) OR
    (domain='HN-FT' AND problem_id IN ('HN-FT-01','HN-FT-04','HN-FT-06')) OR
    (domain='HN-X' AND problem_id='HN-X-02'))))
);
CREATE UNIQUE INDEX IF NOT EXISTS registrations_team_name_idx ON registrations(LOWER(team_name));

CREATE UNIQUE INDEX IF NOT EXISTS registrations_team_identity_idx ON registrations (LOWER(REGEXP_REPLACE(BTRIM(team_name), '[[:space:]]+', ' ', 'g')));
