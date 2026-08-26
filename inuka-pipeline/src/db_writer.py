"""
db_writer.py
============
Direct database writer for Inuka Pulse ETL/ML pipeline.

Writes pipeline output directly to Railway PostgreSQL, eliminating the
need for intermediate R2 storage and backend polling.

Tables written:
  - beneficiary_prediction: ML predictions (from inuka_predictions_export.json)
  - fact_incidents: Incident records (from live_batch.json)
  - fact_audits: Audit records (from live_batch.json)
  - ingest_log: Batch metadata for data lineage

Usage:
    # As a module
    from src.db_writer import write_predictions_to_db, write_batch_to_db

    # Standalone
    python -m src.db_writer

Environment:
    DATABASE_URL: PostgreSQL connection string
                  e.g. postgresql://user:pass@host:port/dbname
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import psycopg2
from psycopg2.extras import execute_values

# ── Paths ─────────────────────────────────────────────────────────────────────
WAREHOUSE_DIR = Path(__file__).parent.parent / "data" / "warehouse"
PREDICTIONS_FILE = WAREHOUSE_DIR / "inuka_predictions_export.json"
LIVE_BATCH_FILE = WAREHOUSE_DIR / "live_batch.json"


def get_db_connection():
    """Get PostgreSQL connection from DATABASE_URL environment variable."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise EnvironmentError(
            "DATABASE_URL not set. Set it to your PostgreSQL connection string:\n"
            "  export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
        )
    return psycopg2.connect(db_url)


def write_predictions_to_db(predictions: Optional[list[dict]] = None) -> int:
    """
    Write beneficiary predictions to the beneficiary_prediction table.
    
    Uses UPSERT (INSERT ... ON CONFLICT UPDATE) to handle re-runs gracefully.
    
    Args:
        predictions: List of prediction dicts. If None, loads from JSON file.
        
    Returns:
        Number of rows written/updated.
    """
    if predictions is None:
        if not PREDICTIONS_FILE.exists():
            print(f"  Predictions file not found: {PREDICTIONS_FILE}")
            return 0
        with open(PREDICTIONS_FILE) as f:
            predictions = json.load(f)
    
    if not predictions:
        print("  No predictions to write")
        return 0
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Prepare data for batch insert
            rows = []
            for p in predictions:
                rows.append((
                    p.get("beneficiary_id"),
                    p.get("cohort_id"),
                    p.get("pillar"),
                    p.get("county"),
                    p.get("as_of_date"),  # already string YYYY-MM-DD
                    float(p.get("dropout_prob", 0)),
                    p.get("predicted_band", "Active"),
                    p.get("top_features"),
                ))
            
            # UPSERT: insert or update on conflict
            sql = """
                INSERT INTO beneficiary_prediction 
                    (beneficiary_id, cohort_id, pillar, county, as_of_date, 
                     dropout_prob, predicted_band, top_features, created_at)
                VALUES %s
                ON CONFLICT (beneficiary_id, as_of_date) 
                DO UPDATE SET
                    cohort_id = EXCLUDED.cohort_id,
                    pillar = EXCLUDED.pillar,
                    county = EXCLUDED.county,
                    dropout_prob = EXCLUDED.dropout_prob,
                    predicted_band = EXCLUDED.predicted_band,
                    top_features = EXCLUDED.top_features,
                    created_at = CURRENT_TIMESTAMP
            """
            
            # Add created_at timestamp to each row
            now = datetime.now(timezone.utc)
            rows_with_ts = [(*row, now) for row in rows]
            
            execute_values(
                cur, sql, rows_with_ts,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            
            conn.commit()
            print(f"  ✓ Wrote {len(rows)} predictions to beneficiary_prediction")
            return len(rows)
            
    finally:
        conn.close()


def write_incidents_to_db(incidents: list[dict], batch_id: str) -> int:
    """
    Write incident records to fact_incidents table.
    
    Args:
        incidents: List of incident dicts from live_batch.json
        batch_id: Batch identifier for tracking
        
    Returns:
        Number of rows written.
    """
    if not incidents:
        print("  No incidents to write")
        return 0
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # First, get valid site IDs from dim_site
            cur.execute("SELECT site_id FROM dim_site")
            valid_sites = {row[0].lower() for row in cur.fetchall()}
            
            rows = []
            skipped = 0
            now = datetime.now(timezone.utc)
            
            for inc in incidents:
                site_id = (inc.get("site") or "").lower()
                
                # Skip if site doesn't exist in dim_site
                if site_id not in valid_sites:
                    skipped += 1
                    continue
                
                incident_id = inc.get("incident_id")
                if not incident_id:
                    skipped += 1
                    continue
                
                rows.append((
                    incident_id,
                    site_id,
                    inc.get("incident_date"),
                    inc.get("severity", "Medium"),
                    inc.get("description"),
                    inc.get("compliance_score"),
                    inc.get("status", "Open"),
                    None,  # closed_date
                    inc.get("decision", "trusted"),
                    inc.get("decision_reason"),
                    batch_id,
                    now,
                ))
            
            if not rows:
                print(f"  No valid incidents (skipped {skipped} with invalid sites)")
                return 0
            
            # UPSERT incidents
            sql = """
                INSERT INTO fact_incidents 
                    (incident_id, site_id, incident_date, severity, description,
                     compliance_score, status, closed_date, decision, 
                     decision_reason, batch_id, ingestion_timestamp)
                VALUES %s
                ON CONFLICT (incident_id) 
                DO UPDATE SET
                    severity = EXCLUDED.severity,
                    description = EXCLUDED.description,
                    compliance_score = EXCLUDED.compliance_score,
                    status = EXCLUDED.status,
                    decision = EXCLUDED.decision,
                    decision_reason = EXCLUDED.decision_reason,
                    batch_id = EXCLUDED.batch_id,
                    ingestion_timestamp = EXCLUDED.ingestion_timestamp
            """
            
            execute_values(
                cur, sql, rows,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            
            conn.commit()
            print(f"  ✓ Wrote {len(rows)} incidents to fact_incidents (skipped {skipped})")
            return len(rows)
            
    finally:
        conn.close()


def write_audits_to_db(audits: list[dict], batch_id: str) -> int:
    """
    Write audit records to fact_audits table.
    
    Args:
        audits: List of audit dicts from live_batch.json
        batch_id: Batch identifier for tracking
        
    Returns:
        Number of rows written.
    """
    if not audits:
        print("  No audits to write")
        return 0
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get valid site IDs
            cur.execute("SELECT site_id FROM dim_site")
            valid_sites = {row[0].lower() for row in cur.fetchall()}
            
            rows = []
            skipped = 0
            now = datetime.now(timezone.utc)
            
            for audit in audits:
                site_id = (audit.get("site") or "").lower()
                
                if site_id not in valid_sites:
                    skipped += 1
                    continue
                
                audit_id = audit.get("audit_id")
                if not audit_id:
                    skipped += 1
                    continue
                
                rows.append((
                    audit_id,
                    site_id,
                    audit.get("inspection_date"),
                    audit.get("auditor"),
                    audit.get("findings_detail"),
                    audit.get("compliance_score"),
                    audit.get("status") == "Open",  # follow_up_required
                    audit.get("closed_date"),
                    audit.get("decision", "trusted"),
                    audit.get("decision_reason"),
                    batch_id,
                    now,
                ))
            
            if not rows:
                print(f"  No valid audits (skipped {skipped} with invalid sites)")
                return 0
            
            # UPSERT audits
            sql = """
                INSERT INTO fact_audits 
                    (audit_id, site_id, inspection_date, auditor, findings,
                     compliance_score, follow_up_required, closed_date,
                     decision, decision_reason, batch_id, ingestion_timestamp)
                VALUES %s
                ON CONFLICT (audit_id) 
                DO UPDATE SET
                    auditor = EXCLUDED.auditor,
                    findings = EXCLUDED.findings,
                    compliance_score = EXCLUDED.compliance_score,
                    follow_up_required = EXCLUDED.follow_up_required,
                    closed_date = EXCLUDED.closed_date,
                    decision = EXCLUDED.decision,
                    decision_reason = EXCLUDED.decision_reason,
                    batch_id = EXCLUDED.batch_id,
                    ingestion_timestamp = EXCLUDED.ingestion_timestamp
            """
            
            execute_values(
                cur, sql, rows,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            
            conn.commit()
            print(f"  ✓ Wrote {len(rows)} audits to fact_audits (skipped {skipped})")
            return len(rows)
            
    finally:
        conn.close()


def write_ingest_log(batch_id: str, row_count: int, source: str = "github_actions") -> None:
    """
    Write an entry to ingest_log for data lineage tracking.
    
    Args:
        batch_id: Unique batch identifier
        row_count: Total rows processed
        source: Source identifier
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ingest_log 
                    (batch_id, source_filename, row_count, sha256_checksum, 
                     ingestion_timestamp, trusted_count)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (batch_id) DO NOTHING
            """, (
                batch_id,
                source,
                row_count,
                str(hash(batch_id)),  # Simple hash for tracking
                datetime.now(timezone.utc),
                row_count,
            ))
            conn.commit()
            print(f"  ✓ Logged batch {batch_id[:8]}... ({row_count} rows)")
    finally:
        conn.close()


def write_batch_to_db(batch: Optional[dict] = None) -> dict:
    """
    Write a complete live_batch.json to the database.
    
    Args:
        batch: Batch dict. If None, loads from live_batch.json file.
        
    Returns:
        Summary dict with counts.
    """
    if batch is None:
        if not LIVE_BATCH_FILE.exists():
            print(f"  Batch file not found: {LIVE_BATCH_FILE}")
            return {"predictions": 0, "incidents": 0, "audits": 0}
        with open(LIVE_BATCH_FILE) as f:
            batch = json.load(f)
    
    batch_id = batch.get("batch_id", str(datetime.now(timezone.utc).timestamp()))
    
    incidents_count = write_incidents_to_db(batch.get("incidents", []), batch_id)
    audits_count = write_audits_to_db(batch.get("audits", []), batch_id)
    
    total = incidents_count + audits_count
    if total > 0:
        write_ingest_log(batch_id, total, "live_batch.json")
    
    return {
        "batch_id": batch_id,
        "incidents": incidents_count,
        "audits": audits_count,
    }


def write_all_to_db() -> dict:
    """
    Write all pipeline outputs to database:
      1. Beneficiary predictions (inuka_predictions_export.json)
      2. Incidents and audits (live_batch.json)
    
    Returns:
        Summary dict with all counts.
    """
    print("\n=== Database Writer ===")
    print(f"  Timestamp: {datetime.now(timezone.utc).isoformat()}")
    
    # Write predictions
    predictions_count = write_predictions_to_db()
    
    # Write batch (incidents + audits)
    batch_result = write_batch_to_db()
    
    summary = {
        "predictions": predictions_count,
        "incidents": batch_result.get("incidents", 0),
        "audits": batch_result.get("audits", 0),
        "batch_id": batch_result.get("batch_id"),
    }
    
    print(f"\n  Summary: {summary['predictions']} predictions, "
          f"{summary['incidents']} incidents, {summary['audits']} audits")
    print("========================\n")
    
    return summary


# ── CLI entry point ───────────────────────────────────────────────────────────

def main():
    """Command-line entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Write Inuka pipeline output directly to PostgreSQL"
    )
    parser.add_argument(
        "--predictions-only", 
        action="store_true",
        help="Write only predictions (skip incidents/audits)"
    )
    parser.add_argument(
        "--batch-only",
        action="store_true", 
        help="Write only batch data (incidents/audits)"
    )
    args = parser.parse_args()
    
    if args.predictions_only:
        write_predictions_to_db()
    elif args.batch_only:
        write_batch_to_db()
    else:
        write_all_to_db()


if __name__ == "__main__":
    main()
