BEGIN;
ALTER TABLE registrations ALTER COLUMN domain DROP NOT NULL;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_check;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_problem_domain_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_problem_domain_check CHECK (
  problem_id IS NULL OR (domain IS NOT NULL AND (
    (domain='HN-AI' AND problem_id IN ('HN-AI-01','HN-AI-02','HN-AI-06','HN-AI-05')) OR
    (domain='HN-CS' AND problem_id IN ('HN-CS-01','HN-CS-02','HN-CS-03','HN-CS-04','HN-CS-05','HN-CS-06','HN-CS-07')) OR
    (domain='HN-FT' AND problem_id IN ('HN-FT-01','HN-FT-04','HN-FT-06')) OR
    (domain='HN-X' AND problem_id='HN-X-02')
  ))
);
CREATE UNIQUE INDEX IF NOT EXISTS registrations_team_identity_idx
ON registrations (LOWER(REGEXP_REPLACE(BTRIM(team_name), '[[:space:]]+', ' ', 'g')));
COMMIT;
