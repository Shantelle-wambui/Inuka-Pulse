-- V5: Schema corrections — align DB with JPA entities

-- Add coordinates to fact_incidents (IncidentEntity)
-- Used by the Kenya cohort risk heatmap to plot incident locations
ALTER TABLE fact_incidents ADD COLUMN latitude  DOUBLE PRECISION;
ALTER TABLE fact_incidents ADD COLUMN longitude DOUBLE PRECISION;
