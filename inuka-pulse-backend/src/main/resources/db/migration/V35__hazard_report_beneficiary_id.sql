-- V35: Add beneficiary_id to hazard_report
--
-- Welfare concerns raised from the beneficiary detail page need to carry
-- the specific beneficiary's ID so case managers can trace the escalation
-- back to the individual rather than only the cohort/site.
--
-- Nullable: existing hazard reports and site-level reports remain valid
-- without this field. Only welfare_concern reports (report_type='welfare_concern')
-- are expected to populate it.

ALTER TABLE hazard_report
    ADD COLUMN IF NOT EXISTS beneficiary_id VARCHAR(50) NULL;

CREATE INDEX IF NOT EXISTS idx_hazard_beneficiary
    ON hazard_report(beneficiary_id)
    WHERE beneficiary_id IS NOT NULL;
