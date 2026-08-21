-- V2: Inuka Foundation cohort seed data
-- Seeds the 12 Inuka programme cohorts across 4 pillars and Kenyan counties.
-- These are the canonical dim_site records for all Inuka Pulse data flows.
-- Pillar codes: sc=Scholarship, pl=Plus, vn=Vocational, tc=Tech

INSERT INTO dim_site (site_id, site_name, location) VALUES
    -- Scholarship pillar
    ('cohort-sc-001', 'Scholarship — Nairobi',  'Nairobi County, Kenya'),
    ('cohort-sc-002', 'Scholarship — Mombasa',  'Mombasa County, Kenya'),
    ('cohort-sc-003', 'Scholarship — Nakuru',   'Nakuru County, Kenya'),
    ('cohort-sc-007', 'Scholarship — Kisumu',   'Kisumu County, Kenya'),
    -- Plus pillar
    ('cohort-pl-001', 'Plus — Nairobi',         'Nairobi County, Kenya'),
    ('cohort-pl-007', 'Plus — Kisumu',          'Kisumu County, Kenya'),
    -- Vocational pillar
    ('cohort-vn-001', 'Vocational — Nairobi',   'Nairobi County, Kenya'),
    ('cohort-vn-003', 'Vocational — Nakuru',    'Nakuru County, Kenya'),
    ('cohort-vn-026', 'Vocational — Eldoret',   'Uasin Gishu County, Kenya'),
    -- Tech pillar
    ('cohort-tc-001', 'Tech — Nairobi',         'Nairobi County, Kenya'),
    ('cohort-tc-002', 'Tech — Mombasa',         'Mombasa County, Kenya'),
    ('cohort-tc-007', 'Tech — Kisumu',          'Kisumu County, Kenya')
ON CONFLICT (site_id) DO NOTHING;
