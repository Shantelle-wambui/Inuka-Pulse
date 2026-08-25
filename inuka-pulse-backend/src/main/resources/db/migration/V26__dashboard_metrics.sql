-- V26: Dashboard metrics materialized table for fast reads
-- Part of Phase 1: Domain & Data Model Extension
-- Pre-computed KPIs refreshed each ETL cycle

CREATE TABLE dashboard_metrics (
    metric_key        VARCHAR(100) NOT NULL,
    scope_type        VARCHAR(50)  NOT NULL,  -- 'org', 'pillar', 'county', 'program', 'donor', 'cohort'
    scope_id          VARCHAR(100) NOT NULL,  -- ID within scope type (e.g., 'Scholarship', 'donor-001')
    period            VARCHAR(20)  NOT NULL,  -- 'current', 'daily', 'weekly', 'monthly', 'ytd', '30d', '90d'
    metric_value      NUMERIC(15,4) NOT NULL,
    previous_value    NUMERIC(15,4),
    change_pct        NUMERIC(7,4),
    trend_direction   VARCHAR(10),  -- 'up', 'down', 'stable'
    is_available      BOOLEAN      DEFAULT TRUE,  -- False if data insufficient
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (metric_key, scope_type, scope_id, period)
);

-- Standard metric keys (documented for frontend consistency):
-- KPI strip: 'total_beneficiaries', 'active_beneficiaries', 'at_risk_cohorts', 'completion_rate'
-- Reach: 'total_reach', 'reach_forecast_30d', 'reach_forecast_90d'
-- Funding: 'total_funding', 'disbursed_amount', 'disbursement_rate', 'funding_gap'
-- Risk: 'high_risk_count', 'critical_alerts', 'dropout_rate'
-- Capacity: 'capacity_utilization', 'available_capacity'
-- Outcomes: 'employment_rate', 'skill_acquisition_rate'

-- Indexes for fast dashboard reads
CREATE INDEX idx_dashboard_metrics_scope ON dashboard_metrics(scope_type, scope_id);
CREATE INDEX idx_dashboard_metrics_key ON dashboard_metrics(metric_key);
CREATE INDEX idx_dashboard_metrics_updated ON dashboard_metrics(updated_at DESC);

-- Extend fact_predictions with prediction_type discriminator for multi-model support
ALTER TABLE fact_predictions ADD COLUMN IF NOT EXISTS prediction_type VARCHAR(50) DEFAULT 'dropout';
ALTER TABLE fact_predictions ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4);
ALTER TABLE fact_predictions ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT FALSE;
ALTER TABLE fact_predictions ADD COLUMN IF NOT EXISTS review_status VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_predictions_type ON fact_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_review ON fact_predictions(requires_review) WHERE requires_review = TRUE;
