-- V27: Extend model_registry for 5 model families
-- Part of Phase 1: Domain & Data Model Extension
-- Adds model_family discriminator and HITL review columns

-- Add model_family column to model_registry (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'model_registry') THEN
        ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS model_family VARCHAR(50) DEFAULT 'dropout';
    END IF;
END $$;

-- Extend model_feedback for all prediction types
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'model_feedback') THEN
        ALTER TABLE model_feedback ADD COLUMN IF NOT EXISTS prediction_type VARCHAR(50);
        ALTER TABLE model_feedback ADD COLUMN IF NOT EXISTS override_value NUMERIC(15,4);
        ALTER TABLE model_feedback ADD COLUMN IF NOT EXISTS decision VARCHAR(20);  -- 'accept', 'reject', 'override'
    END IF;
END $$;

-- HITL review queue table for pending reviews
CREATE TABLE IF NOT EXISTS hitl_review_queue (
    id                VARCHAR(50)  PRIMARY KEY,
    prediction_id     BIGINT       NOT NULL,
    model_family      VARCHAR(50)  NOT NULL,
    entity_id         VARCHAR(50)  NOT NULL,  -- site_id, program_id, county, etc.
    entity_type       VARCHAR(50)  NOT NULL,  -- 'cohort', 'program', 'county'
    predicted_value   NUMERIC(15,4) NOT NULL,
    confidence        NUMERIC(5,4),
    review_reason     TEXT,
    priority          INTEGER      DEFAULT 0,  -- Higher = more urgent
    assigned_to       VARCHAR(50),
    status            VARCHAR(20)  DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'escalated', 'expired')),
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    expires_at        TIMESTAMP,
    completed_at      TIMESTAMP,
    completed_by      VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_hitl_queue_status ON hitl_review_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_hitl_queue_family ON hitl_review_queue(model_family);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_priority ON hitl_review_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_assigned ON hitl_review_queue(assigned_to);
