-- V24: Officer–Cohort Assignment
--
-- Links a Case Manager (app_user) to the cohorts they are responsible for.
-- A Case Manager sees only beneficiaries in their assigned cohorts.
--
-- One officer can be assigned to multiple cohorts (e.g. COHORT-SC-001 + COHORT-SC-002).
-- One cohort can have multiple officers (shared caseload is supported).
--
-- This is additive — no existing tables are altered.

CREATE TABLE IF NOT EXISTS officer_cohort_assignment (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    cohort_id   VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_officer_cohort UNIQUE (user_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS idx_oca_user_id   ON officer_cohort_assignment(user_id);
CREATE INDEX IF NOT EXISTS idx_oca_cohort_id ON officer_cohort_assignment(cohort_id);

-- ── Seed: assign officer@inuka.org to a representative set of cohorts ─────────
--
-- officer@inuka.org (Grace Wanjiku) is seeded as Case Manager.
-- We assign her to two Scholarship cohorts and one Tech cohort so the
-- dashboard shows a meaningful caseload on first run.
--
-- The sub-select looks up her user id by email so this is idempotent
-- even if the auto-generated id differs between environments.

INSERT INTO officer_cohort_assignment (user_id, cohort_id)
SELECT u.id, c.cohort_id
FROM   app_user u
CROSS JOIN (
    VALUES
        ('COHORT-SC-001'),
        ('COHORT-SC-002'),
        ('COHORT-TC-001')
) AS c(cohort_id)
WHERE  u.email = 'officer@inuka.org'
ON CONFLICT (user_id, cohort_id) DO NOTHING;
