-- V23: Program and Donor tables for M&E scope
-- Part of Phase 1: Domain & Data Model Extension
-- Adds program, donor, and donor_funding tables per docs/11-system-rebuild-plan.md

-- Program entity (links to existing dim_site cohorts)
CREATE TABLE program (
    program_id        VARCHAR(50)  PRIMARY KEY,
    pillar            VARCHAR(20)  NOT NULL CHECK (pillar IN ('Scholarship', 'Plus', 'Vocational', 'Tech')),
    name              VARCHAR(255) NOT NULL,
    county            VARCHAR(100) NOT NULL,
    start_date        DATE         NOT NULL,
    end_date          DATE,
    target_capacity   INTEGER      NOT NULL CHECK (target_capacity > 0),
    status            VARCHAR(20)  NOT NULL DEFAULT 'planned' CHECK (status IN ('active', 'completed', 'planned')),
    description       TEXT,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Donor entity
CREATE TABLE donor (
    donor_id          VARCHAR(50)  PRIMARY KEY,
    name              VARCHAR(255) NOT NULL UNIQUE,
    contact_email     VARCHAR(255),
    contact_phone     VARCHAR(50),
    organization_type VARCHAR(50),  -- 'foundation', 'corporate', 'government', 'individual', 'ngo'
    country           VARCHAR(100),
    is_active         BOOLEAN      DEFAULT TRUE,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Donor funding (many-to-many: donors fund programs)
CREATE TABLE donor_funding (
    id                VARCHAR(50)  PRIMARY KEY,
    donor_id          VARCHAR(50)  NOT NULL REFERENCES donor(donor_id),
    program_id        VARCHAR(50)  NOT NULL REFERENCES program(program_id),
    amount_kes        NUMERIC(15,2) NOT NULL CHECK (amount_kes >= 0),
    currency          VARCHAR(3)   DEFAULT 'KES',
    fiscal_year       INTEGER      NOT NULL CHECK (fiscal_year BETWEEN 2020 AND 2040),
    disbursed_to_date NUMERIC(15,2) DEFAULT 0 CHECK (disbursed_to_date >= 0),
    funding_status    VARCHAR(20)  DEFAULT 'active' CHECK (funding_status IN ('active', 'completed', 'suspended', 'pending')),
    commitment_date   DATE,
    notes             TEXT,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_donor_program_year UNIQUE (donor_id, program_id, fiscal_year)
);

-- Add program_id foreign key to dim_site (cohort → program linkage)
ALTER TABLE dim_site ADD COLUMN program_id VARCHAR(50) REFERENCES program(program_id);

-- Indexes for performance
CREATE INDEX idx_program_pillar ON program(pillar);
CREATE INDEX idx_program_county ON program(county);
CREATE INDEX idx_program_status ON program(status);
CREATE INDEX idx_donor_active ON donor(is_active);
CREATE INDEX idx_donor_funding_donor ON donor_funding(donor_id);
CREATE INDEX idx_donor_funding_program ON donor_funding(program_id);
CREATE INDEX idx_donor_funding_year ON donor_funding(fiscal_year);
CREATE INDEX idx_site_program ON dim_site(program_id);
