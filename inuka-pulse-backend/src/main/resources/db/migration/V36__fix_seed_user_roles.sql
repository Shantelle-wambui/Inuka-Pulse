-- V36: Fix seed user roles
--
-- Problems identified in audit:
--   1. officer@inuka.org was seeded as 'HSE Manager' — should be 'Case Manager'
--      so they can access /api/beneficiaries/my-caseload on the mobile app.
--   2. director@inuka.org was seeded as 'HSE Manager' — should be 'Programme Director'
--      so they land on the correct dashboard after login.
--   3. Seed a Coordinator account for testing coordinator workflows.
--   4. Seed a Donor role (missing from all previous migrations).
--
-- All changes are idempotent — safe to run on any environment.

-- ── 1. Fix officer@inuka.org → Case Manager ───────────────────────────────────
UPDATE app_user
SET role_id = (SELECT id FROM app_role WHERE name = 'Case Manager')
WHERE email = 'officer@inuka.org'
  AND role_id = (SELECT id FROM app_role WHERE name = 'HSE Manager');

-- ── 2. Fix director@inuka.org → Programme Director ───────────────────────────
UPDATE app_user
SET role_id = (SELECT id FROM app_role WHERE name = 'Programme Director')
WHERE email = 'director@inuka.org'
  AND role_id = (SELECT id FROM app_role WHERE name = 'HSE Manager');

-- ── 3. Seed Donor role (never inserted in any prior migration) ────────────────
INSERT INTO app_role (name, description)
VALUES ('Donor', 'External donor — read-only access to funded programme dashboards and impact reports')
ON CONFLICT (name) DO NOTHING;

-- ── 4. Seed Coordinator account ───────────────────────────────────────────────
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

-- ── 5. Seed Donor account ─────────────────────────────────────────────────────
-- Password: sentinel@admin (BCrypt cost 12) — rotate after first login
INSERT INTO app_user (name, email, password_hash, status, joined_at, role_id)
SELECT
    'Demo Donor',
    'donor@inuka.org',
    '$2b$12$gzoLrXb6t2OKhgrIIc5LMOpkZF3ctPUPWBi2Q1YBS6rY4pXVIUcSq',
    'Active',
    NOW(),
    r.id
FROM app_role r
WHERE r.name = 'Donor'
  AND NOT EXISTS (
    SELECT 1 FROM app_user WHERE email = 'donor@inuka.org'
  );
