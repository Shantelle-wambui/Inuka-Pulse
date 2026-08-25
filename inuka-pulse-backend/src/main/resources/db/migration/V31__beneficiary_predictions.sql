-- V23: Beneficiary-level dropout risk predictions
--
-- Stores the ML pipeline output from inuka_predictions_export.json.
-- One row per beneficiary per as_of_date snapshot.
--
-- This is separate from fact_predictions (which is site/cohort-level).
-- Do not merge — the two tables serve different purposes:
--   fact_predictions       → cohort/site-level probability (used by risk heatmap)
--   beneficiary_prediction → individual beneficiary risk (used by dashboards)

CREATE TABLE IF NOT EXISTS beneficiary_prediction (
    id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    beneficiary_id   VARCHAR(50)  NOT NULL,
    cohort_id        VARCHAR(50)  NULL,
    pillar           VARCHAR(100) NULL,
    county           VARCHAR(100) NULL,
    as_of_date       DATE         NOT NULL,
    dropout_prob     NUMERIC(7,4) NOT NULL,
    predicted_band   VARCHAR(50)  NOT NULL,  -- Active | At-Risk | Disengaged | Dropout
    top_features     TEXT         NULL,      -- pipe-delimited, e.g. "attendance_rate_30d|field_visit_gap_days"
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- One prediction per beneficiary per date (upsert-safe)
    CONSTRAINT uq_ben_prediction_id_date UNIQUE (beneficiary_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_ben_pred_band       ON beneficiary_prediction(predicted_band);
CREATE INDEX IF NOT EXISTS idx_ben_pred_county     ON beneficiary_prediction(county);
CREATE INDEX IF NOT EXISTS idx_ben_pred_pillar     ON beneficiary_prediction(pillar);
CREATE INDEX IF NOT EXISTS idx_ben_pred_cohort     ON beneficiary_prediction(cohort_id);
CREATE INDEX IF NOT EXISTS idx_ben_pred_date       ON beneficiary_prediction(as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_ben_pred_prob       ON beneficiary_prediction(dropout_prob DESC);
