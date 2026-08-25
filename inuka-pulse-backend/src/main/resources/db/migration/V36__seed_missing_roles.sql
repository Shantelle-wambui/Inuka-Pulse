-- V36: Seed missing RBAC roles and a test donor user
--
-- Roles referenced in SecurityConfig and @PreAuthorize annotations but never
-- inserted into app_role:
--
--   • "Donor"       → JWT authority ROLE_DONOR
--                     SecurityConfig: hasAnyRole("DONOR") on /api/v1/programs GET, /api/v1/donors GET
--                     DonorController: hasRole('DONOR') / canAccessDonor checks
--
--   • "Executive"   → JWT authority ROLE_EXECUTIVE
--                     SecurityConfig: hasAnyRole("EXECUTIVE") on allocations, programs, donors
--                     DonorController: hasAnyRole('EXECUTIVE', 'ADMIN')
--
--   • "Data Analyst" → JWT authority ROLE_DATA_ANALYST
--                     SecurityConfig: hasAnyRole("DATA_ANALYST") on /api/v1/programs GET
--
--   • "HSE Manager" → JWT authority ROLE_HSE_MANAGER
--                     V4 user seed references this role; the two users (officer@inuka.org,
--                     director@inuka.org) were silently skipped because no matching row existed.
--
-- All inserts use ON CONFLICT DO NOTHING so this migration is safe to re-run
-- and will not fail if any role already exists.
--
-- JwtAuthFilter authority mapping:
--   role name → toUpperCase().replace(" ", "_") → prefixed with "ROLE_"
--   e.g. "Data Analyst" → ROLE_DATA_ANALYST   ✓ matches hasAnyRole("DATA_ANALYST")
--        "Donor"        → ROLE_DONOR           ✓ matches hasRole("DONOR")
--        "Executive"    → ROLE_EXECUTIVE        ✓ matches hasAnyRole("EXECUTIVE")
--        "HSE Manager"  → ROLE_HSE_MANAGER      ✓
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Missing roles ─────────────────────────────────────────────────────────────

INSERT INTO app_role (name, description)
VALUES ('Donor', 'External donor with read-only access to their own funding summaries and programme progress')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app_role (name, description)
VALUES ('Executive', 'Senior leadership with read access to dashboards, allocations, and cross-programme analytics')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app_role (name, description)
VALUES ('Data Analyst', 'Analytics team member with read access to programme data and performance indicators')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app_role (name, description)
VALUES ('HSE Manager', 'Health, Safety & Environment manager with access to welfare reports and field operations')
ON CONFLICT (name) DO NOTHING;

-- ── Re-seed V4 users that were silently skipped (Manager role now exists) ────────
-- These use the same BCrypt hash from V4: password = sentinel@admin (cost 12)

INSERT INTO app_user (name, email, password_hash, status, joined_at, role_id)
SELECT
    u.name,
    u.email,
    '$2b$12$gzoLrXb6t2OKhgrIIc5LMOpkZF3ctPUPWBi2Q1YBS6rY4pXVIUcSq',
    'Active',
    NOW(),
    r.id
FROM (VALUES
    ('Grace Wanjiku',   'officer@inuka.org',   'HSE Manager'),
    ('Esther Adhiambo', 'director@inuka.org',  'HSE Manager')
) AS u(name, email, role_name)
JOIN app_role r ON r.name = u.role_name
WHERE NOT EXISTS (
    SELECT 1 FROM app_user au WHERE au.email = u.email
);

-- ── Seed test donor user ──────────────────────────────────────────────────────
-- Password: sentinel@admin (same BCrypt hash as all other seed accounts)
-- This account is for development/testing of the donor portal only.
-- Remove or rotate in production.

INSERT INTO app_user (name, email, password_hash, status, joined_at, role_id)
SELECT
    'Test Donor',
    'donor@inuka.org',
    '$2b$12$gzoLrXb6t2OKhgrIIc5LMOpkZF3ctPUPWBi2Q1YBS6rY4pXVIUcSq',
    'Active',
    NOW(),
    r.id
FROM app_role r
WHERE r.name = 'Donor'
  AND NOT EXISTS (
      SELECT 1 FROM app_user au WHERE au.email = 'donor@inuka.org'
  );
