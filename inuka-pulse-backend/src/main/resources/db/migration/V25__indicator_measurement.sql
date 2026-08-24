-- V25: M&E Indicator and Measurement tables
-- Part of Phase 1: Domain & Data Model Extension
-- Supports output → outcome → impact tracking per Requirement 5

-- M&E Indicator definitions
CREATE TABLE indicator (
    indicator_id      VARCHAR(50)  PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    category          VARCHAR(20)  NOT NULL CHECK (category IN ('output', 'outcome', 'impact')),
    unit              VARCHAR(50)  NOT NULL,  -- 'count', 'percentage', 'KES', 'ratio'
    definition        TEXT,
    calculation_method TEXT,        -- How the indicator is computed
    data_source       VARCHAR(255), -- Where the raw data comes from
    frequency         VARCHAR(20)  DEFAULT 'monthly',  -- 'daily', 'weekly', 'monthly', 'quarterly', 'annual'
    target_direction  VARCHAR(10)  DEFAULT 'higher',   -- 'higher', 'lower', 'target'
    version           INTEGER      DEFAULT 1,
    is_active         BOOLEAN      DEFAULT TRUE,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Measurement values (time series)
CREATE TABLE measurement (
    id                VARCHAR(50)  PRIMARY KEY,
    indicator_id      VARCHAR(50)  NOT NULL REFERENCES indicator(indicator_id),
    program_id        VARCHAR(50)  REFERENCES program(program_id),
    site_id           VARCHAR(50)  REFERENCES dim_site(site_id),  -- Cohort-level measurement
    county            VARCHAR(100),
    pillar            VARCHAR(20),
    period_start      DATE         NOT NULL,
    period_end        DATE         NOT NULL,
    value             NUMERIC(15,4) NOT NULL,
    target_value      NUMERIC(15,4),  -- Target for comparison
    previous_value    NUMERIC(15,4),  -- Prior period for trend
    variance_pct      NUMERIC(7,4),   -- Computed: (value - previous_value) / previous_value
    data_quality_flag VARCHAR(20)  DEFAULT 'verified',  -- 'verified', 'estimated', 'provisional'
    computed_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    notes             TEXT
);

-- Indexes for time-series queries
CREATE INDEX idx_measurement_indicator ON measurement(indicator_id);
CREATE INDEX idx_measurement_program ON measurement(program_id);
CREATE INDEX idx_measurement_site ON measurement(site_id);
CREATE INDEX idx_measurement_period ON measurement(period_start, period_end);
CREATE INDEX idx_measurement_indicator_period ON measurement(indicator_id, period_start DESC);
CREATE INDEX idx_indicator_category ON indicator(category);
CREATE INDEX idx_indicator_active ON indicator(is_active);
