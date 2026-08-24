-- ============================================================================
-- V29: Performance Indexes for Query Optimization
-- ============================================================================
-- Purpose: Add indexes to improve query performance for dashboard, analytics,
--          and ML prediction queries at 100K beneficiary scale.
-- ============================================================================

-- ── Prediction Queries ───────────────────────────────────────────────────────
-- Used by: HITL review queue, prediction dashboard, model performance tracking

-- Fast lookup of predictions by cohort and type
CREATE INDEX IF NOT EXISTS idx_predictions_cohort_type_date 
    ON fact_predictions(cohort_id, prediction_type, predicted_at DESC);

-- Fast lookup of pending predictions for HITL review
CREATE INDEX IF NOT EXISTS idx_predictions_status_date 
    ON fact_predictions(status, predicted_at DESC) 
    WHERE status = 'pending';

-- Model performance tracking by model version
CREATE INDEX IF NOT EXISTS idx_predictions_model_date 
    ON fact_predictions(model_registry_id, predicted_at DESC);

-- ── Dashboard Metrics ────────────────────────────────────────────────────────
-- Used by: KPI strip, pillar rollups, county rollups, donor portal

-- Primary lookup pattern: scope_type + scope_id
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_scope 
    ON dashboard_metrics(scope_type, scope_id);

-- Time-based queries for trend analysis
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_updated 
    ON dashboard_metrics(updated_at DESC);

-- Specific metric lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_key_scope 
    ON dashboard_metrics(metric_key, scope_type);

-- ── Program & Funding Queries ────────────────────────────────────────────────
-- Used by: Programs dashboard, donor portal, allocation recommendations

-- Program lookup by pillar and county
CREATE INDEX IF NOT EXISTS idx_program_pillar_county 
    ON program(pillar, county);

-- Active programs filter (most common query)
CREATE INDEX IF NOT EXISTS idx_program_status 
    ON program(status) 
    WHERE status = 'active';

-- Funding by program (for capacity utilization)
CREATE INDEX IF NOT EXISTS idx_donor_funding_program 
    ON donor_funding(program_id);

-- Funding by donor (for donor portal)
CREATE INDEX IF NOT EXISTS idx_donor_funding_donor_fy 
    ON donor_funding(donor_id, fiscal_year);

-- Active funding records
CREATE INDEX IF NOT EXISTS idx_donor_funding_status 
    ON donor_funding(funding_status) 
    WHERE funding_status = 'active';

-- ── Resource Allocation Queries ──────────────────────────────────────────────
-- Used by: Allocation dashboard, ML recommendation reviews

-- Allocation by program and period
CREATE INDEX IF NOT EXISTS idx_allocation_program_period 
    ON resource_allocation(program_id, period_start, period_end);

-- Pending allocations (HITL queue)
CREATE INDEX IF NOT EXISTS idx_allocation_pending 
    ON resource_allocation(approved_at) 
    WHERE approved_at IS NULL;

-- ML-recommended allocations
CREATE INDEX IF NOT EXISTS idx_allocation_source 
    ON resource_allocation(source) 
    WHERE source = 'ml_recommended';

-- ── Measurement & Indicator Queries ──────────────────────────────────────────
-- Used by: M&E dashboard, impact metrics, trend analysis

-- Measurement lookup by indicator and period
CREATE INDEX IF NOT EXISTS idx_measurement_indicator_period 
    ON measurement(indicator_id, period_start DESC);

-- Measurement by program (for program impact)
CREATE INDEX IF NOT EXISTS idx_measurement_program 
    ON measurement(program_id);

-- Measurement by county (for geographic analysis)
CREATE INDEX IF NOT EXISTS idx_measurement_county 
    ON measurement(county);

-- Active indicators
CREATE INDEX IF NOT EXISTS idx_indicator_active 
    ON indicator(is_active) 
    WHERE is_active = TRUE;

-- ── Beneficiary & Cohort Queries ─────────────────────────────────────────────
-- Used by: Dropout predictions, cohort dashboard, alert generation

-- Cohort lookup by program (for program-level analytics)
CREATE INDEX IF NOT EXISTS idx_cohort_program 
    ON dim_beneficiary_cohort(program_id);

-- At-risk cohorts (alert generation)
CREATE INDEX IF NOT EXISTS idx_cohort_risk 
    ON dim_beneficiary_cohort(risk_level) 
    WHERE risk_level IN ('High', 'Critical');

-- Beneficiary lookup by status
CREATE INDEX IF NOT EXISTS idx_beneficiary_status 
    ON dim_beneficiary(current_status);

-- ── Model Registry & Feedback ────────────────────────────────────────────────
-- Used by: Model admin portal, retraining triggers

-- Active models by family
CREATE INDEX IF NOT EXISTS idx_model_registry_family_active 
    ON model_registry(model_family, is_champion) 
    WHERE is_champion = TRUE;

-- Feedback by model type (for retraining threshold checks)
CREATE INDEX IF NOT EXISTS idx_model_feedback_type_date 
    ON model_feedback(prediction_type, created_at DESC);

-- ── Alert Queries ────────────────────────────────────────────────────────────
-- Used by: Alert dashboard, notification system

-- Unresolved alerts
CREATE INDEX IF NOT EXISTS idx_alert_status_priority 
    ON alert(status, priority DESC) 
    WHERE status IN ('open', 'acknowledged');

-- Alerts by cohort
CREATE INDEX IF NOT EXISTS idx_alert_cohort 
    ON alert(cohort_id);

-- ============================================================================
-- ANALYZE TABLES (refresh statistics for query planner)
-- ============================================================================
-- Note: In production, run ANALYZE on these tables after initial data load
-- and periodically (e.g., after each ETL cycle)

-- PostgreSQL: ANALYZE fact_predictions, dashboard_metrics, program, donor_funding, ...
-- H2: ANALYZE (no table specification needed)
