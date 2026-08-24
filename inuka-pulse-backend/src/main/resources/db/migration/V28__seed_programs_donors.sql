-- V28: Seed data for programs, donors, and initial indicators
-- Part of Phase 1: Provides baseline data for development and testing

-- Seed programs (one per existing cohort, grouped by county)
INSERT INTO program (program_id, pillar, name, county, start_date, target_capacity, status, description) VALUES
    -- Nairobi programs (multi-pillar hub)
    ('prog-nrb-sc-2024', 'Scholarship', 'Nairobi Scholarship 2024', 'Nairobi', '2024-01-15', 500, 'active', 'University scholarship program for Nairobi youth'),
    ('prog-nrb-pl-2024', 'Plus', 'Nairobi Plus 2024', 'Nairobi', '2024-02-01', 300, 'active', 'Skills enhancement program for secondary graduates'),
    ('prog-nrb-vn-2024', 'Vocational', 'Nairobi Vocational 2024', 'Nairobi', '2024-01-20', 400, 'active', 'Technical skills training in construction and electrical'),
    ('prog-nrb-tc-2024', 'Tech', 'Nairobi Tech 2024', 'Nairobi', '2024-03-01', 200, 'active', 'Software development and IT certification program'),
    
    -- Mombasa programs
    ('prog-msa-sc-2024', 'Scholarship', 'Mombasa Scholarship 2024', 'Mombasa', '2024-01-15', 350, 'active', 'Coastal region scholarship initiative'),
    ('prog-msa-tc-2024', 'Tech', 'Mombasa Tech 2024', 'Mombasa', '2024-04-01', 150, 'active', 'Blue economy tech skills program'),
    
    -- Nakuru programs
    ('prog-nkr-sc-2024', 'Scholarship', 'Nakuru Scholarship 2024', 'Nakuru', '2024-01-15', 300, 'active', 'Rift Valley scholarship program'),
    ('prog-nkr-vn-2024', 'Vocational', 'Nakuru Vocational 2024', 'Nakuru', '2024-02-15', 350, 'active', 'Agricultural and mechanical training'),
    
    -- Kisumu programs
    ('prog-ksm-sc-2024', 'Scholarship', 'Kisumu Scholarship 2024', 'Kisumu', '2024-01-15', 280, 'active', 'Lake region scholarship initiative'),
    ('prog-ksm-pl-2024', 'Plus', 'Kisumu Plus 2024', 'Kisumu', '2024-03-01', 200, 'active', 'Entrepreneurship and business skills'),
    ('prog-ksm-tc-2024', 'Tech', 'Kisumu Tech 2024', 'Kisumu', '2024-04-15', 120, 'active', 'Digital skills for fisheries and trade'),
    
    -- Eldoret program
    ('prog-eld-vn-2024', 'Vocational', 'Eldoret Vocational 2024', 'Uasin Gishu', '2024-02-01', 300, 'active', 'Athletics and hospitality training')
ON CONFLICT (program_id) DO NOTHING;

-- Link existing cohorts to programs
UPDATE dim_site SET program_id = 'prog-nrb-sc-2024' WHERE site_id = 'cohort-sc-001';
UPDATE dim_site SET program_id = 'prog-msa-sc-2024' WHERE site_id = 'cohort-sc-002';
UPDATE dim_site SET program_id = 'prog-nkr-sc-2024' WHERE site_id = 'cohort-sc-003';
UPDATE dim_site SET program_id = 'prog-ksm-sc-2024' WHERE site_id = 'cohort-sc-007';
UPDATE dim_site SET program_id = 'prog-nrb-pl-2024' WHERE site_id = 'cohort-pl-001';
UPDATE dim_site SET program_id = 'prog-ksm-pl-2024' WHERE site_id = 'cohort-pl-007';
UPDATE dim_site SET program_id = 'prog-nrb-vn-2024' WHERE site_id = 'cohort-vn-001';
UPDATE dim_site SET program_id = 'prog-nkr-vn-2024' WHERE site_id = 'cohort-vn-003';
UPDATE dim_site SET program_id = 'prog-eld-vn-2024' WHERE site_id = 'cohort-vn-026';
UPDATE dim_site SET program_id = 'prog-nrb-tc-2024' WHERE site_id = 'cohort-tc-001';
UPDATE dim_site SET program_id = 'prog-msa-tc-2024' WHERE site_id = 'cohort-tc-002';
UPDATE dim_site SET program_id = 'prog-ksm-tc-2024' WHERE site_id = 'cohort-tc-007';

-- Seed donors
INSERT INTO donor (donor_id, name, contact_email, organization_type, country, is_active) VALUES
    ('donor-001', 'Mastercard Foundation', 'partnerships@mastercardfdn.org', 'foundation', 'Canada', TRUE),
    ('donor-002', 'USAID Kenya', 'kenya@usaid.gov', 'government', 'USA', TRUE),
    ('donor-003', 'Safaricom Foundation', 'foundation@safaricom.co.ke', 'corporate', 'Kenya', TRUE),
    ('donor-004', 'UK Aid', 'kenya@fcdo.gov.uk', 'government', 'UK', TRUE),
    ('donor-005', 'Equity Group Foundation', 'foundation@equitybank.co.ke', 'corporate', 'Kenya', TRUE),
    ('donor-006', 'Generation Kenya', 'kenya@generation.org', 'ngo', 'USA', TRUE),
    ('donor-007', 'African Development Bank', 'education@afdb.org', 'foundation', 'Ivory Coast', TRUE)
ON CONFLICT (donor_id) DO NOTHING;

-- Seed donor funding relationships
INSERT INTO donor_funding (id, donor_id, program_id, amount_kes, fiscal_year, disbursed_to_date, funding_status, commitment_date) VALUES
    -- Mastercard Foundation - major scholarship donor
    ('fund-001', 'donor-001', 'prog-nrb-sc-2024', 25000000.00, 2024, 18750000.00, 'active', '2023-11-01'),
    ('fund-002', 'donor-001', 'prog-msa-sc-2024', 17500000.00, 2024, 13125000.00, 'active', '2023-11-01'),
    ('fund-003', 'donor-001', 'prog-nkr-sc-2024', 15000000.00, 2024, 11250000.00, 'active', '2023-11-01'),
    ('fund-004', 'donor-001', 'prog-ksm-sc-2024', 14000000.00, 2024, 10500000.00, 'active', '2023-11-01'),
    
    -- USAID - vocational focus
    ('fund-005', 'donor-002', 'prog-nrb-vn-2024', 20000000.00, 2024, 15000000.00, 'active', '2023-12-01'),
    ('fund-006', 'donor-002', 'prog-nkr-vn-2024', 17500000.00, 2024, 13125000.00, 'active', '2023-12-01'),
    ('fund-007', 'donor-002', 'prog-eld-vn-2024', 15000000.00, 2024, 11250000.00, 'active', '2023-12-01'),
    
    -- Safaricom Foundation - tech programs
    ('fund-008', 'donor-003', 'prog-nrb-tc-2024', 10000000.00, 2024, 7500000.00, 'active', '2024-01-15'),
    ('fund-009', 'donor-003', 'prog-msa-tc-2024', 7500000.00, 2024, 5625000.00, 'active', '2024-01-15'),
    ('fund-010', 'donor-003', 'prog-ksm-tc-2024', 6000000.00, 2024, 4500000.00, 'active', '2024-01-15'),
    
    -- UK Aid - Plus programs
    ('fund-011', 'donor-004', 'prog-nrb-pl-2024', 15000000.00, 2024, 11250000.00, 'active', '2024-02-01'),
    ('fund-012', 'donor-004', 'prog-ksm-pl-2024', 10000000.00, 2024, 7500000.00, 'active', '2024-02-01'),
    
    -- Equity Group Foundation - co-funding
    ('fund-013', 'donor-005', 'prog-nrb-sc-2024', 5000000.00, 2024, 3750000.00, 'active', '2024-01-01'),
    ('fund-014', 'donor-005', 'prog-nkr-vn-2024', 5000000.00, 2024, 3750000.00, 'active', '2024-01-01')
ON CONFLICT (id) DO NOTHING;

-- Seed M&E indicators
INSERT INTO indicator (indicator_id, name, category, unit, definition, frequency, target_direction) VALUES
    -- Output indicators
    ('ind-out-001', 'Total Enrolled', 'output', 'count', 'Total beneficiaries enrolled across all programs', 'monthly', 'higher'),
    ('ind-out-002', 'Active Enrolled', 'output', 'count', 'Currently active enrollments', 'weekly', 'higher'),
    ('ind-out-003', 'Sessions Delivered', 'output', 'count', 'Training sessions completed', 'monthly', 'higher'),
    ('ind-out-004', 'Attendance Rate', 'output', 'percentage', 'Average attendance across sessions', 'weekly', 'higher'),
    ('ind-out-005', 'Field Visits Completed', 'output', 'count', 'Monitoring visits by field officers', 'monthly', 'higher'),
    ('ind-out-006', 'Disbursements Made', 'output', 'KES', 'Total stipends and materials disbursed', 'monthly', 'target'),
    
    -- Outcome indicators
    ('ind-otc-001', 'Completion Rate', 'outcome', 'percentage', 'Beneficiaries who completed their program', 'quarterly', 'higher'),
    ('ind-otc-002', 'Retention Rate 90d', 'outcome', 'percentage', 'Beneficiaries still active after 90 days', 'monthly', 'higher'),
    ('ind-otc-003', 'Dropout Rate', 'outcome', 'percentage', 'Beneficiaries who disengaged before completion', 'monthly', 'lower'),
    ('ind-otc-004', 'Assessment Pass Rate', 'outcome', 'percentage', 'Beneficiaries passing skill assessments', 'quarterly', 'higher'),
    ('ind-otc-005', 'Employment Rate', 'outcome', 'percentage', 'Completers employed within 6 months', 'quarterly', 'higher'),
    ('ind-otc-006', 'Self-Employment Rate', 'outcome', 'percentage', 'Completers starting businesses', 'quarterly', 'higher'),
    
    -- Impact indicators
    ('ind-imp-001', 'Cost per Beneficiary', 'impact', 'KES', 'Total program cost divided by beneficiaries served', 'annual', 'lower'),
    ('ind-imp-002', 'Cost per Outcome', 'impact', 'KES', 'Total cost divided by positive outcomes achieved', 'annual', 'lower'),
    ('ind-imp-003', 'Income Improvement', 'impact', 'percentage', 'Average income increase post-program', 'annual', 'higher'),
    ('ind-imp-004', 'Livelihood Sustainability', 'impact', 'percentage', 'Beneficiaries maintaining improved livelihood after 1 year', 'annual', 'higher')
ON CONFLICT (indicator_id) DO NOTHING;
