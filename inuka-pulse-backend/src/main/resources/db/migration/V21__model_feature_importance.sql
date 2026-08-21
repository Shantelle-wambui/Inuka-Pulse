-- V21: Store feature importance JSON per model version in model_registry
-- Enables champion-vs-challenger explainability diff in the ML Admin Compare page.
-- Shape mirrors the existing inuka_feature_importance.json warehouse artifact:
--   { "featureName": weight_as_float, ... }
-- Populated when a training run completes (via POST /api/ml/training-run body).

ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS feature_importance TEXT NULL;

-- Backfill the seeded champion (inuka_logreg_v1) with the known feature importance values
-- from inuka-pipeline/data/warehouse/inuka_feature_importance.json
UPDATE model_registry
SET feature_importance = '{
  "engagement_score_30d": 0.952,
  "days_since_last_contact": 0.21,
  "dropout_rate_90d": 0.18,
  "missed_disbursement_count": 0.09,
  "cohort_completion_rate": 0.08
}'
WHERE id = '00000000-0000-0000-0000-000000000001';
