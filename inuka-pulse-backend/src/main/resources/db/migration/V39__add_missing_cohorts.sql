-- V39: Add missing cohorts to dim_site
--
-- The pipeline generates 20 cohorts (4 pillars × 5 counties) but V2 only
-- seeded 12. This causes db_writer.py to skip incidents for non-existent
-- cohorts, resulting in missing data on the frontend.
--
-- This migration adds the 8 missing cohorts so all pipeline data flows through.
-- Uses ON CONFLICT DO NOTHING for idempotency.

INSERT INTO dim_site (site_id, site_name, location) VALUES
    -- Scholarship missing (1)
    ('cohort-sc-026', 'Scholarship — Eldoret', 'Uasin Gishu County, Kenya'),
    
    -- Plus missing (3)
    ('cohort-pl-002', 'Plus — Mombasa', 'Mombasa County, Kenya'),
    ('cohort-pl-003', 'Plus — Nakuru', 'Nakuru County, Kenya'),
    ('cohort-pl-026', 'Plus — Eldoret', 'Uasin Gishu County, Kenya'),
    
    -- Vocational missing (2)
    ('cohort-vn-002', 'Vocational — Mombasa', 'Mombasa County, Kenya'),
    ('cohort-vn-007', 'Vocational — Kisumu', 'Kisumu County, Kenya'),
    
    -- Tech missing (2)
    ('cohort-tc-003', 'Tech — Nakuru', 'Nakuru County, Kenya'),
    ('cohort-tc-026', 'Tech — Eldoret', 'Uasin Gishu County, Kenya')
ON CONFLICT (site_id) DO NOTHING;

-- Link new cohorts to programs (matching the pattern from V28)
UPDATE dim_site SET program_id = 'prog-eld-vn-2024' WHERE site_id = 'cohort-sc-026' AND program_id IS NULL;
UPDATE dim_site SET program_id = 'prog-msa-sc-2024' WHERE site_id = 'cohort-pl-002' AND program_id IS NULL;
UPDATE dim_site SET program_id = 'prog-nkr-sc-2024' WHERE site_id = 'cohort-pl-003' AND program_id IS NULL;
UPDATE dim_site SET program_id = 'prog-eld-vn-2024' WHERE site_id = 'cohort-pl-026' AND program_id IS NULL;
UPDATE dim_site SET program_id = 'prog-msa-tc-2024' WHERE site_id = 'cohort-vn-002' AND program_id IS NULL;
UPDATE dim_site SET program_id = 'prog-ksm-tc-2024' WHERE site_id = 'cohort-vn-007' AND program_id IS NULL;
UPDATE dim_site SET program_id = 'prog-nkr-vn-2024' WHERE site_id = 'cohort-tc-003' AND program_id IS NULL;
UPDATE dim_site SET program_id = 'prog-eld-vn-2024' WHERE site_id = 'cohort-tc-026' AND program_id IS NULL;
