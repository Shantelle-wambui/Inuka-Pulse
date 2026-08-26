-- V40: Seed Officer Cohort Assignments
--
-- V32 creates the officer_cohort_assignment table and tries to seed it,
-- but the INSERT silently fails if officer@inuka.org doesn't exist yet
-- (the WHERE clause filters out non-existent users).
--
-- This migration ensures the seed data exists by running AFTER all user
-- seeds have been applied (V4, V36, V38).
--
-- Assigns officer@inuka.org to three representative cohorts:
--   - COHORT-SC-001 (Scholarship)
--   - COHORT-SC-002 (Scholarship)
--   - COHORT-TC-001 (Tech)
--
-- Idempotent: uses ON CONFLICT DO NOTHING.

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
