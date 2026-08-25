-- Add beneficiary_id to fact_incidents for alert→incident→CAPA traceability

ALTER TABLE fact_incidents
ADD COLUMN beneficiary_id VARCHAR(50);

-- Index for efficient lookup by beneficiary
CREATE INDEX idx_fact_incidents_beneficiary ON fact_incidents(beneficiary_id);

-- Comment for documentation
COMMENT ON COLUMN fact_incidents.beneficiary_id IS 'Links incident to specific beneficiary (e.g. BEN-00001)';
