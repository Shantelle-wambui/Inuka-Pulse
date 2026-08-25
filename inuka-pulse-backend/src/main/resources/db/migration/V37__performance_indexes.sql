-- ============================================================================
-- V29: Performance Indexes for Query Optimization
-- ============================================================================
-- Purpose: Add indexes to improve query performance for dashboard, analytics,
--          and ML prediction queries.
-- ============================================================================

-- ── Prediction Queries ───────────────────────────────────────────────────────
-- fact_predictions: site_id, as_of_date, probability, model_version

-- Index already exists from V15: idx_predictions_site_date

-- ── Dashboard Metrics ────────────────────────────────────────────────────────
-- Only create if table exists (may not exist in all deployments)

CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_scope 
    ON dashboard_metrics(scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_updated 
    ON dashboard_metrics(updated_at DESC);

-- ── Program & Funding Queries ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_program_pillar_county 
    ON program(pillar, county);

CREATE INDEX IF NOT EXISTS idx_program_status 
    ON program(status) 
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_donor_funding_program 
    ON donor_funding(program_id);

CREATE INDEX IF NOT EXISTS idx_donor_funding_donor_fy 
    ON donor_funding(donor_id, fiscal_year);

CREATE INDEX IF NOT EXISTS idx_donor_funding_status 
    ON donor_funding(funding_status) 
    WHERE funding_status = 'active';

-- ── Beneficiary Predictions ──────────────────────────────────────────────────
-- beneficiary_prediction table (used by AnalyticsService)

CREATE INDEX IF NOT EXISTS idx_beneficiary_prediction_band 
    ON beneficiary_prediction(predicted_band);

CREATE INDEX IF NOT EXISTS idx_beneficiary_prediction_county 
    ON beneficiary_prediction(county);

CREATE INDEX IF NOT EXISTS idx_beneficiary_prediction_pillar 
    ON beneficiary_prediction(pillar);

CREATE INDEX IF NOT EXISTS idx_beneficiary_prediction_cohort 
    ON beneficiary_prediction(cohort_id);

CREATE INDEX IF NOT EXISTS idx_beneficiary_prediction_date 
    ON beneficiary_prediction(as_of_date DESC);

-- ── Site/Cohort Queries ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dim_site_program 
    ON dim_site(program_id);

-- ── Alert Queries ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_alerts_status 
    ON alerts(status);

CREATE INDEX IF NOT EXISTS idx_alerts_site_rule 
    ON alerts(site_id, rule);

CREATE INDEX IF NOT EXISTS idx_alerts_created 
    ON alerts(created_at DESC);
