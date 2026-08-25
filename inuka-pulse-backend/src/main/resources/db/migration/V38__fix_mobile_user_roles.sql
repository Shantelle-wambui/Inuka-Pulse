-- V38: Fix user roles for mobile app access
--
-- V36 (seed_missing_roles) correctly seeds HSE Manager role and re-seeds
-- officer@inuka.org and director@inuka.org as HSE Manager because that role
-- didn't exist when V4 ran.
--
-- However for the mobile Case Manager app to work:
--   • officer@inuka.org  must be 'Case Manager'   → can call /api/beneficiaries/predictions/my-caseload
--   • director@inuka.org must be 'Programme Director' → lands on correct dashboard after login
--
-- This migration runs after V36/V37 and corrects those two accounts.
-- All statements are idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. officer@inuka.org → Case Manager ──────────────────────────────────────
UPDATE app_user
SET role_id = (SELECT id FROM app_role WHERE name = 'Case Manager')
WHERE email = 'officer@inuka.org'
  AND EXISTS (SELECT 1 FROM app_role WHERE name = 'Case Manager');

-- ── 2. director@inuka.org → Programme Director ───────────────────────────────
UPDATE app_user
SET role_id = (SELECT id FROM app_role WHERE name = 'Programme Director')
WHERE email = 'director@inuka.org'
  AND EXISTS (SELECT 1 FROM app_role WHERE name = 'Programme Director');

-- ── 3. Seed Coordinator account (if not already present) ─────────────────────
-- Password: sentinel@admin (BCrypt cost 12) — rotate after first login
INSERT INTO app_user (name, email, password_hash, status, joined_at, role_id)
SELECT
    'Amina Coordinator',
    'coordinator@inuka.org',
    '$2b$12$gzoLrXb6t2OKhgrIIc5LMOpkZF3ctPUPWBi2Q1YBS6rY4pXVIUcSq',
    'Active',
    NOW(),
    r.id
FROM app_role r
WHERE r.name = 'Coordinator'
  AND NOT EXISTS (
    SELECT 1 FROM app_user WHERE email = 'coordinator@inuka.org'
  );
