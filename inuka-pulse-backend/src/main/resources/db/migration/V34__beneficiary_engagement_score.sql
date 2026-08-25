-- V34: Add engagement_score and engagement_band to beneficiary_prediction
--
-- engagement_score (0–100): a composite index of how actively engaged a
-- beneficiary is, computed from their dropout probability and risk band.
-- Higher = more engaged. This is a server-computed field, updated whenever
-- the ETL reloads predictions.
--
-- engagement_band: Low (0–39) | Medium (40–69) | High (70–100)
--
-- Both columns are nullable so existing rows are not broken on migration.
-- EtlReloadService populates them on every load cycle.

ALTER TABLE beneficiary_prediction
    ADD COLUMN IF NOT EXISTS engagement_score  NUMERIC(5,2)  NULL,
    ADD COLUMN IF NOT EXISTS engagement_band   VARCHAR(20)   NULL;

-- Back-fill existing rows using the same formula the service will use going
-- forward: score = (1 - dropout_prob) * 100, clamped to [0, 100].
-- Band thresholds: Low < 40, Medium 40–69, High >= 70.
UPDATE beneficiary_prediction
SET
    engagement_score = ROUND(LEAST(GREATEST((1.0 - dropout_prob) * 100, 0), 100), 2),
    engagement_band  = CASE
        WHEN (1.0 - dropout_prob) * 100 >= 70 THEN 'High'
        WHEN (1.0 - dropout_prob) * 100 >= 40 THEN 'Medium'
        ELSE 'Low'
    END
WHERE engagement_score IS NULL;
