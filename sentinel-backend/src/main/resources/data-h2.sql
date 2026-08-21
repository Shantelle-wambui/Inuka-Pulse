-- data-h2.sql — loaded by spring.sql.init on H2 dev profile only (create-drop).
-- Seeds Inuka Foundation cohort locations so the risk API returns real data
-- without Flyway. Incidents, assessments, and disbursements are injected by
-- the ETL pipeline at runtime.

INSERT INTO dim_site (site_id, site_name, location) VALUES
  ('cohort-sc-001', 'Scholarship — Nairobi',    'Nairobi County, Kenya'),
  ('cohort-sc-002', 'Scholarship — Mombasa',    'Mombasa County, Kenya'),
  ('cohort-sc-026', 'Scholarship — Eldoret',    'Uasin Gishu County, Kenya'),
  ('cohort-pl-001', 'Plus — Nairobi',           'Nairobi County, Kenya'),
  ('cohort-pl-007', 'Plus — Kisumu',            'Kisumu County, Kenya'),
  ('cohort-vn-003', 'Vocational — Nakuru',      'Nakuru County, Kenya'),
  ('cohort-vn-001', 'Vocational — Nairobi',     'Nairobi County, Kenya'),
  ('cohort-vn-026', 'Vocational — Eldoret',     'Uasin Gishu County, Kenya'),
  ('cohort-tc-007', 'Tech — Kisumu',            'Kisumu County, Kenya'),
  ('cohort-tc-001', 'Tech — Nairobi',           'Nairobi County, Kenya'),
  ('cohort-tc-002', 'Tech — Mombasa',           'Mombasa County, Kenya');
