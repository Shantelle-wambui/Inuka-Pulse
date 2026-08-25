-- V4: Inuka Foundation default user accounts
--
-- All accounts use BCrypt password: sentinel@admin (cost 12)
-- Hash: $2b$12$gzoLrXb6t2OKhgrIIc5LMOpkZF3ctPUPWBi2Q1YBS6rY4pXVIUcSq
--
-- Rotate passwords after first login in production.
--
-- Roles seeded in V3 (Admin, HSE Manager, Auditor, Analyst, Viewer)
-- Additional roles seeded in V14 (Field Officer, Programme Director, Coordinator, ML Admin)

INSERT INTO app_user (name, email, password_hash, status, joined_at, role_id)
SELECT
    u.name,
    u.email,
    '$2b$12$gzoLrXb6t2OKhgrIIc5LMOpkZF3ctPUPWBi2Q1YBS6rY4pXVIUcSq',
    'Active',
    NOW(),
    r.id
FROM (VALUES
    ('Inuka Admin',       'admin@inuka.org',     'Admin'),
    ('Grace Wanjiku',     'officer@inuka.org',   'HSE Manager'),
    ('Brian Omondi',      'analyst@inuka.org',   'Analyst'),
    ('Esther Adhiambo',   'director@inuka.org',  'HSE Manager'),
    ('ML Admin Inuka',    'ml.admin@inuka.org',  'ML Admin')
) AS u(name, email, role_name)
JOIN app_role r ON r.name = u.role_name
WHERE NOT EXISTS (
    SELECT 1 FROM app_user au WHERE au.email = u.email
);
