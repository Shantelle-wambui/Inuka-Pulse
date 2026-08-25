"""
inuka_live_bridge.py
====================
Converts Inuka Foundation programme data into the live_batch.json format
that the Sentinel Spring Boot backend reads every 2 minutes.

This is the bridge between the Inuka Python pipeline and the Java backend.

Mapping:
  Inuka predictions (dropout_prob >= 0.50) → backend "incidents"
  Inuka field visits (last 60 days)        → backend "audits"

Usage:
    python3 src/inuka_live_bridge.py

Output:
    inuka-pipeline/data/warehouse/live_batch.json  (overwritten each run)
"""

import json
import uuid
import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR  = Path(__file__).parent.parent
RAW_DIR   = BASE_DIR / "data" / "raw" / "inuka"
WAREHOUSE = BASE_DIR / "data" / "warehouse"
OUT_FILE  = WAREHOUSE / "live_batch.json"

PREDICTIONS_FILE  = WAREHOUSE / "inuka_predictions_export.json"
FIELD_VISITS_FILE = RAW_DIR  / "fact_field_visits.csv"

# ── Cohort coordinates (mirrors RiskService.SITE_COORDS in Java) ──────────────

COHORT_COORDS = {
    "cohort-sc-001": (-1.272, 36.770),   # Scholarship — Nairobi
    "cohort-sc-002": (-4.079, 39.628),   # Scholarship — Mombasa
    "cohort-sc-003": (-0.350, 36.039),   # Scholarship — Nakuru
    "cohort-sc-007": (-0.096, 34.784),   # Scholarship — Kisumu
    "cohort-pl-001": (-1.278, 36.809),   # Plus — Nairobi
    "cohort-pl-007": (-0.115, 34.755),   # Plus — Kisumu
    "cohort-vn-001": (-1.302, 36.843),   # Vocational — Nairobi
    "cohort-vn-003": (-0.312, 36.087),   # Vocational — Nakuru  ← HIGH RISK
    "cohort-vn-026": ( 0.508, 35.261),   # Vocational — Eldoret
    "cohort-tc-001": (-1.268, 36.820),   # Tech — Nairobi
    "cohort-tc-002": (-4.038, 39.680),   # Tech — Mombasa
    "cohort-tc-007": (-0.091, 34.769),   # Tech — Kisumu        ← HIGH RISK
}

# ── Batch limits ──────────────────────────────────────────────────────────────

MAX_INCIDENTS = 200   # highest dropout_prob first
MAX_AUDITS    = 100   # most recent field visits first
VISIT_WINDOW_DAYS = 60
INCIDENT_THRESHOLD = 0.50  # include predictions >= 50% dropout probability


# ── Helpers ───────────────────────────────────────────────────────────────────

def cohort_id_normalise(raw: str) -> str:
    """COHORT-SC-001 → cohort-sc-001 (match Java DB keys)"""
    return raw.lower().replace("_", "-")


def severity_from_prob(prob: float) -> str:
    if prob >= 0.70:
        return "Critical"
    if prob >= 0.60:
        return "High"
    return "Medium"


def iso_date(date_str: str) -> str:
    """Normalise any date-like string to ISO 8601 with Z suffix."""
    if not date_str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    # Try common formats
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ",
                "%d/%m/%Y", "%m/%d/%Y"):
        try:
            dt = datetime.strptime(date_str[:19], fmt[:len(date_str)])
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue
    # Best effort: just return as-is with Z
    return date_str[:10] + "T00:00:00Z"


def blank_row_template(batch_id: str, source: str) -> dict:
    """Base template with all live_batch.json fields set to None."""
    return {
        "beneficiary_id": None,  # explicit field for traceability
        "incident_id": None, "site": None, "latitude": None, "longitude": None,
        "incident_date": None, "incident_type": None, "severity": None,
        "compliance_score": None, "description": None, "root_cause": None,
        "response_time_hours": None, "status": None,
        "audit_id": None, "inspection_date": None, "closed_date": None,
        "finding_category": None, "findings_detail": None,
        "corrective_action": None, "auditor": None,
        "reading_id": None, "timestamp": None, "pipeline_section": None,
        "pressure_psi": None, "flow_rate_bph": None,
        "temperature_celsius": None, "valve_status": None, "sensor_id": None,
        "_source_file": source,
        "_batch_id": batch_id,
        "decision": "trusted",
        "decision_reason": "all rules passed",
    }


# ── Step 1: Load Inuka predictions → incidents ────────────────────────────────

def load_predictions_as_incidents(batch_id: str) -> list[dict]:
    print(f"  Loading predictions from {PREDICTIONS_FILE} …")
    with open(PREDICTIONS_FILE) as f:
        predictions = json.load(f)

    # Filter to At-Risk / Dropout predictions only
    eligible = [p for p in predictions if p.get("dropout_prob", 0) >= INCIDENT_THRESHOLD]
    # Sort by highest risk first
    eligible.sort(key=lambda p: p.get("dropout_prob", 0), reverse=True)
    # Cap
    eligible = eligible[:MAX_INCIDENTS]

    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    today_tag = datetime.now(timezone.utc).strftime("%Y%m%d")

    incidents = []
    for p in eligible:
        ben_id   = p.get("beneficiary_id", "UNKNOWN")
        cohort   = cohort_id_normalise(p.get("cohort_id", ""))
        prob     = float(p.get("dropout_prob", 0))
        band     = p.get("predicted_band", "At-Risk")
        features = p.get("top_features", "")
        top_feat = features.split("|")[0] if features else "attendance_rate_30d"

        coords   = COHORT_COORDS.get(cohort, (0.0, 0.0))
        severity = severity_from_prob(prob)

        row = blank_row_template(batch_id, "inuka_predictions_export.json")
        row.update({
            "beneficiary_id" : ben_id,
            "incident_id"    : f"INC-{ben_id}-{today_tag}",
            "site"           : cohort,
            "latitude"       : coords[0],
            "longitude"      : coords[1],
            "incident_date"  : today_iso,
            "incident_type"  : "Beneficiary Dropout Risk",
            "severity"       : severity,
            "compliance_score": round((1.0 - prob) * 100, 1),
            "description"    : (
                f"{ben_id}: dropout probability {prob:.2f} ({band}). "
                f"Top risk drivers: {features.replace('|', ', ')}"
            ),
            "root_cause"     : top_feat.replace("_", " "),
            "status"         : "Open",
            "decision"       : "trusted" if prob >= INCIDENT_THRESHOLD else "review",
            "decision_reason": (
                f"dropout probability {prob:.2f} >= {INCIDENT_THRESHOLD} threshold"
                if prob >= INCIDENT_THRESHOLD
                else "dropout probability below threshold — review"
            ),
        })
        incidents.append(row)

    print(f"  → {len(incidents)} incidents generated "
          f"(Critical: {sum(1 for i in incidents if i['severity']=='Critical')}, "
          f"High: {sum(1 for i in incidents if i['severity']=='High')}, "
          f"Medium: {sum(1 for i in incidents if i['severity']=='Medium')})")
    return incidents


# ── Step 2: Load field visits → audits ────────────────────────────────────────

def load_field_visits_as_audits(batch_id: str) -> list[dict]:
    print(f"  Loading field visits from {FIELD_VISITS_FILE} …")
    cutoff = datetime.now(timezone.utc) - timedelta(days=VISIT_WINDOW_DAYS)

    visits = []
    with open(FIELD_VISITS_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse visit date
            visit_date_str = row.get("visit_date", "")
            try:
                visit_dt = datetime.strptime(visit_date_str[:10], "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                continue  # skip rows with unparseable dates

            if visit_dt < cutoff:
                continue  # outside our window

            visits.append({
                "visit_id"  : row.get("visit_id", ""),
                "cohort_id" : cohort_id_normalise(row.get("cohort_id", "")),
                "visit_date": visit_dt,
                "officer"   : row.get("officer_name", ""),
                "outcome"   : row.get("visit_outcome", ""),
                "lat"       : row.get("gps_latitude", ""),
                "lon"       : row.get("gps_longitude", ""),
            })

    # Sort most recent first, then cap
    visits.sort(key=lambda v: v["visit_date"], reverse=True)
    visits = visits[:MAX_AUDITS]

    audits = []
    for v in visits:
        cohort = v["cohort_id"]
        coords = COHORT_COORDS.get(cohort, (0.0, 0.0))

        row = blank_row_template(batch_id, "fact_field_visits.csv")
        row.update({
            "audit_id"        : f"FV-{v['visit_id']}",
            "site"            : cohort,
            "latitude"        : coords[0],
            "longitude"       : coords[1],
            "inspection_date" : v["visit_date"].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "compliance_score": 70.0,  # default score — actual not in visit data
            "finding_category": "Field Visit",
            "findings_detail" : (
                f"Field officer visit — outcome: {v['outcome']}" if v["outcome"]
                else "Field officer visit recorded"
            ),
            "auditor"         : v["officer"] or "Program Officer",
            "status"          : "Closed",
            "decision"        : "trusted",
            "decision_reason" : "field visit record — all rules passed",
        })
        audits.append(row)

    print(f"  → {len(audits)} audit records generated from field visits")
    return audits


# ── Step 3: Assemble and write live_batch.json ────────────────────────────────

def run():
    print("\n=== Inuka Live Bridge ===")
    print(f"  Timestamp: {datetime.now(timezone.utc).isoformat()}")

    batch_id = str(uuid.uuid4())
    print(f"  Batch ID: {batch_id}\n")

    incidents = load_predictions_as_incidents(batch_id)
    audits    = load_field_visits_as_audits(batch_id)

    trusted  = sum(1 for i in incidents + audits if i.get("decision") == "trusted")
    review   = sum(1 for i in incidents + audits if i.get("decision") == "review")
    rejected = sum(1 for i in incidents + audits if i.get("decision") == "rejected")

    payload = {
        "batch_id"     : batch_id,
        "timestamp"    : datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "incidents"    : incidents,
        "audits"       : audits,
        "telemetry"    : [],
        "environmental": [],
        "summary"      : {
            "trusted" : trusted,
            "review"  : review,
            "rejected": rejected,
        },
    }

    WAREHOUSE.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, default=str)

    print(f"\n✓ Written to {OUT_FILE}")
    print(f"  Incidents : {len(incidents)}")
    print(f"  Audits    : {len(audits)}")
    print(f"  Summary   : trusted={trusted}, review={review}, rejected={rejected}")
    print(f"\n  The Java backend will pick this up within 2 minutes.")
    print(f"  To force immediate reload, restart the Spring Boot server.")
    print("=========================\n")


if __name__ == "__main__":
    run()
