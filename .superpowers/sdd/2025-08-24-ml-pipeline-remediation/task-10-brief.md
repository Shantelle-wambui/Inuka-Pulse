# Task 10: Database Migration for beneficiary_id (Phase 5, Part 2)

## Files
- Create: `inuka-pulse-backend/src/main/resources/db/migration/V34__incident_beneficiary_id.sql`
- Modify: `inuka-pulse-backend/src/main/java/com/inukapulse/site/IncidentEntity.java`
- Modify: `inuka-pulse-backend/src/main/java/com/inukapulse/etl/EtlReloadService.java` (if incident ingestion exists)

## Interfaces
- Database: `fact_incidents` table gets new `beneficiary_id VARCHAR(50)` column
- Entity: `IncidentEntity` gets new `beneficiaryId` field with JPA mapping
- ETL: If incidents are ingested from live_batch.json, the `beneficiary_id` field must be mapped

## Context

Task 9 added `beneficiary_id` to the live bridge output. Now we need the database and backend to store and expose this field so the alert→incident→CAPA chain can thread back to specific beneficiaries.

Current `IncidentEntity` fields:
- incidentId, siteId, latitude, longitude, incidentDate, severity, description
- complianceScore, status, closedDate, decision, decisionReason
- batchId, ingestionTimestamp

Missing: `beneficiary_id`

## Steps

### Step 1: Create Flyway migration

Create `V34__incident_beneficiary_id.sql`:

```sql
-- Add beneficiary_id to fact_incidents for alert→incident→CAPA traceability

ALTER TABLE fact_incidents
ADD COLUMN beneficiary_id VARCHAR(50);

-- Index for efficient lookup by beneficiary
CREATE INDEX idx_fact_incidents_beneficiary ON fact_incidents(beneficiary_id);

-- Comment for documentation
COMMENT ON COLUMN fact_incidents.beneficiary_id IS 'Links incident to specific beneficiary (e.g. BEN-00001)';
```

### Step 2: Update IncidentEntity

Add to `IncidentEntity.java` (after `siteId` field):

```java
@Column(name = "beneficiary_id", length = 50)
private String beneficiaryId;
```

### Step 3: Update ETL ingestion (if applicable)

Search for where incidents are ingested from live_batch.json. If found in `EtlReloadService.java` or similar, add mapping:

```java
entity.setBeneficiaryId(str(incidentMap, "beneficiary_id"));
```

### Step 4: Verify compilation

```bash
cd inuka-pulse-backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS

### Step 5: Commit

```bash
git add src/main/resources/db/migration/V34__incident_beneficiary_id.sql \
        src/main/java/com/inukapulse/site/IncidentEntity.java \
        src/main/java/com/inukapulse/etl/EtlReloadService.java
git commit -m "feat(backend): add beneficiary_id to incidents table and entity"
```
