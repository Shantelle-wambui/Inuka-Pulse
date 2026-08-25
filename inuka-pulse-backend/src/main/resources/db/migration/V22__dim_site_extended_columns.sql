-- V22: Add extended columns to dim_site that SiteEntity expects
-- These were present in the Java entity but missing from the original V1 DDL.

ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS station_type  VARCHAR(100) NULL;
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS region        VARCHAR(100) NULL;
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS criticality   VARCHAR(50)  NULL;
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS latitude      DOUBLE PRECISION NULL;
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS longitude     DOUBLE PRECISION NULL;
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS is_active     BOOLEAN      NOT NULL DEFAULT TRUE;
