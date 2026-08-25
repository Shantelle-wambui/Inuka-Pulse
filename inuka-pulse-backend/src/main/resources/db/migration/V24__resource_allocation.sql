-- V24: Resource allocation tracking
-- Part of Phase 1: Domain & Data Model Extension
-- Supports Model 5 (Allocation Optimization) workflow

CREATE TABLE resource_allocation (
    id                VARCHAR(50)  PRIMARY KEY,
    program_id        VARCHAR(50)  NOT NULL REFERENCES program(program_id),
    region            VARCHAR(100) NOT NULL,  -- County/region for the allocation
    resource_type     VARCHAR(50)  NOT NULL CHECK (resource_type IN ('field_officer', 'training_capacity', 'budget', 'equipment', 'materials')),
    allocated_amount  NUMERIC(15,2) NOT NULL CHECK (allocated_amount >= 0),
    unit              VARCHAR(50),  -- 'count', 'KES', 'hours', etc.
    period_start      DATE         NOT NULL,
    period_end        DATE         NOT NULL,
    source            VARCHAR(20)  DEFAULT 'manual' CHECK (source IN ('manual', 'ml_recommended')),
    priority_score    NUMERIC(5,2),  -- Model 5 output, if ML-recommended
    rationale         TEXT,          -- Explanation for the allocation
    status            VARCHAR(20)  DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'completed')),
    approved_by       VARCHAR(50),
    approved_at       TIMESTAMP,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_period_valid CHECK (period_end >= period_start)
);

-- Allocation history for audit trail
CREATE TABLE resource_allocation_history (
    id                VARCHAR(50)  PRIMARY KEY,
    allocation_id     VARCHAR(50)  NOT NULL REFERENCES resource_allocation(id),
    action            VARCHAR(50)  NOT NULL,  -- 'created', 'approved', 'rejected', 'modified', 'completed'
    old_status        VARCHAR(20),
    new_status        VARCHAR(20),
    changed_by        VARCHAR(50),
    change_reason     TEXT,
    changed_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_allocation_program ON resource_allocation(program_id);
CREATE INDEX idx_allocation_region ON resource_allocation(region);
CREATE INDEX idx_allocation_type ON resource_allocation(resource_type);
CREATE INDEX idx_allocation_period ON resource_allocation(period_start, period_end);
CREATE INDEX idx_allocation_status ON resource_allocation(status);
CREATE INDEX idx_allocation_source ON resource_allocation(source);
CREATE INDEX idx_allocation_history_allocation ON resource_allocation_history(allocation_id);
