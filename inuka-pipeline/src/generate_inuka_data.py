"""
Inuka Pulse — Synthetic Data Generator
=======================================
Generates realistic, messy beneficiary program datasets for the Inuka Foundation
domain. Covers all four pillars: Scholarship, Plus, Vocational, Tech.

Domain model:
  - 4 pillars × 5 counties = 20 program cohorts (equivalent to KPC sites)
  - ~2 000 beneficiaries with enrollment, attendance, assessment, and
    disbursement records spanning 6 months
  - Two "high-risk" cohorts seeded with weak engagement patterns:
      COHORT-VN-003  (Vocational / Nakuru)  — high dropout, low attendance
      COHORT-TC-007  (Tech / Kisumu)        — disbursement delays, low scores
  - Every injected data-quality issue is logged to ground_truth_issues.csv
    so the detection rate can be calculated honestly in the pitch

Fixed seed for full reproducibility.

Run:
    python3 -m src.generate_inuka_data          # outputs to data/raw/inuka/
    python3 src/generate_inuka_data.py          # same

Outputs (in data/raw/inuka/):
    dim_cohort.csv                  (20 program cohorts)
    dim_beneficiary.csv             (2 000 beneficiary reference records)
    fact_sessions.csv               (weekly session attendance events)
    fact_field_visits.csv           (field officer verification visits)
    fact_disbursements.csv          (monthly stipend disbursement records)
    fact_assessments.csv            (quarterly assessment scores)
    ground_truth_issues.csv         (every injected data quality issue)
    docs/inuka_data_generation_notes.md
"""

import csv
import random
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from faker import Faker

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
fake = Faker("en_GB")          # English names — Faker("sw_KE") not available
Faker.seed(SEED)

# ── Output directories ────────────────────────────────────────────────────────
OUT_DIR     = Path("data/raw/inuka")
DOCS_DIR    = Path("docs")
OUT_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# ── Anchor date ───────────────────────────────────────────────────────────────
TODAY = datetime(2026, 8, 21)
START = TODAY - timedelta(days=180)   # 6-month window

# ── Domain constants ──────────────────────────────────────────────────────────
PILLARS = ["Scholarship", "Plus", "Vocational", "Tech"]

PILLAR_CODES = {
    "Scholarship": "SC",
    "Plus":        "PL",
    "Vocational":  "VN",
    "Tech":        "TC",
}

COUNTIES = [
    {"name": "Nairobi",   "code": "001", "region": "Nairobi"},
    {"name": "Mombasa",   "code": "002", "region": "Coast"},
    {"name": "Nakuru",    "code": "003", "region": "Rift Valley"},
    {"name": "Kisumu",    "code": "007", "region": "Nyanza"},
    {"name": "Eldoret",   "code": "026", "region": "North Rift"},
]

COUNTY_COORDS = {
    "Nairobi":  (-1.286, 36.817),
    "Mombasa":  (-4.043, 39.668),
    "Nakuru":   (-0.303, 36.080),
    "Kisumu":   (-0.102, 34.762),
    "Eldoret":  (0.517,  35.268),
}

# High-risk cohorts — weak engagement, mirrors Makueni/Sinendet in KPC build
HIGH_RISK_COHORTS = {"COHORT-VN-003", "COHORT-TC-007"}

ENGAGEMENT_LEVELS = ["Active", "At-Risk", "Disengaged", "Dropout"]
DISBURSEMENT_STATUSES = ["Paid", "Pending", "Delayed", "Withheld"]
VISIT_OUTCOMES = ["Verified", "Partially Verified", "No Contact", "Referred"]
DROPOUT_REASONS = [
    "Financial hardship",
    "Relocation",
    "Employment (positive exit)",
    "Health issues",
    "Family responsibilities",
    "Academic performance",
    "Program non-compliance",
    "Unknown",
]

# Kenyan first names (mix of communities)
KE_FIRST_NAMES = [
    "Amina", "Brian", "Cynthia", "David", "Esther", "Felix", "Grace", "Hassan",
    "Irene", "James", "Kezia", "Leonard", "Mary", "Nicholas", "Olive", "Patrick",
    "Queen", "Raphael", "Seun", "Tabitha", "Uchenna", "Violet", "Wanjiku", "Xavier",
    "Yvonne", "Zipporah", "Aisha", "Boniface", "Caroline", "Dennis", "Eunice",
    "Francis", "Gladys", "Harrison", "Irene", "Joseph", "Kendi", "Lilian",
    "Maurice", "Nancy", "Owen", "Priscilla", "Quinton", "Rose", "Stephen",
]

KE_SURNAMES = [
    "Wanjiku", "Omondi", "Mwangi", "Kamau", "Otieno", "Njoroge", "Achieng",
    "Kimani", "Ochieng", "Ndung'u", "Mutua", "Waweru", "Adhiambo", "Githinji",
    "Njenga", "Awino", "Kariuki", "Odongo", "Maina", "Were", "Gichuki",
    "Onyango", "Wangari", "Simiyu", "Musyoka", "Auma", "Mugo", "Nyambura",
    "Owino", "Kiprotich", "Chebet", "Mutinda", "Kiplagat", "Rotich",
]


# ============================================================================
# Ground-truth issue tracker
# ============================================================================
issue_log: list[dict] = []

def log_issue(record_id: str, table: str, field: str, issue_type: str, raw_value: str):
    issue_log.append({
        "record_id":  record_id,
        "table":      table,
        "field":      field,
        "issue_type": issue_type,
        "raw_value":  str(raw_value)[:120],
    })


# ============================================================================
# Helpers
# ============================================================================

def rand_date(start: datetime, end: datetime) -> datetime:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, max(delta, 0)))


def ke_name() -> str:
    return f"{random.choice(KE_FIRST_NAMES)} {random.choice(KE_SURNAMES)}"


def dirty_date(dt: datetime, record_id: str, table: str, field: str) -> str:
    """Randomly inject date format messiness."""
    r = random.random()
    if r < 0.04:
        # Future date (impossible)
        future = dt + timedelta(days=random.randint(1, 30))
        log_issue(record_id, table, field, "future_date", future.strftime("%Y-%m-%d"))
        return future.strftime("%Y-%m-%d")
    if r < 0.10:
        # Mixed format (d/m/Y)
        val = dt.strftime("%d/%m/%Y")
        log_issue(record_id, table, field, "mixed_date_format", val)
        return val
    if r < 0.14:
        # UK format
        val = dt.strftime("%d-%b-%Y")
        log_issue(record_id, table, field, "mixed_date_format", val)
        return val
    return dt.strftime("%Y-%m-%d")


def dirty_label(canonical: str, variants: dict, record_id: str,
                table: str, field: str, prob: float = 0.08) -> str:
    """With probability `prob`, replace canonical label with a dirty variant."""
    if random.random() < prob and variants:
        dirty = random.choice(list(variants.keys()))
        log_issue(record_id, table, field, "dirty_label", dirty)
        return dirty
    return canonical


def maybe_missing(value, record_id: str, table: str, field: str, prob: float = 0.03):
    """With probability `prob`, drop a required field."""
    if random.random() < prob:
        log_issue(record_id, table, field, "missing_required_field", str(value))
        return None
    return value


def out_of_range_score(score: float, record_id: str, table: str,
                        field: str, prob: float = 0.03) -> float:
    """Occasionally push a score outside [0, 100]."""
    if random.random() < prob:
        bad = round(score + random.choice([-15, 110, 125]), 1)
        log_issue(record_id, table, field, "out_of_range", bad)
        return bad
    return score


# ============================================================================
# 1. dim_cohort — 20 program cohorts (4 pillars × 5 counties)
# ============================================================================

def build_cohorts() -> list[dict]:
    cohorts = []
    for pillar in PILLARS:
        pcode = PILLAR_CODES[pillar]
        for county in COUNTIES:
            cid = f"COHORT-{pcode}-{county['code']}"
            lat, lon = COUNTY_COORDS[county["name"]]
            # Add small jitter so pins don't overlap
            lat += random.uniform(-0.05, 0.05)
            lon += random.uniform(-0.05, 0.05)
            profile = "high" if cid in HIGH_RISK_COHORTS else "normal"
            cohorts.append({
                "cohort_id":        cid,
                "cohort_name":      f"{pillar} — {county['name']}",
                "pillar":           pillar,
                "county":           county["name"],
                "county_code":      county["code"],
                "region":           county["region"],
                "risk_profile":     profile,
                "latitude":         round(lat, 4),
                "longitude":        round(lon, 4),
                "target_size":      random.randint(80, 150),
                "program_officer":  ke_name(),
            })
    return cohorts


# ============================================================================
# 2. dim_beneficiary — ~2 000 beneficiaries
# ============================================================================

def build_beneficiaries(cohorts: list[dict]) -> list[dict]:
    beneficiaries = []
    idx = 1
    for cohort in cohorts:
        is_high_risk = cohort["cohort_id"] in HIGH_RISK_COHORTS
        # High-risk cohorts get slightly smaller intake
        n = random.randint(70, 110) if is_high_risk else random.randint(90, 130)
        for _ in range(n):
            bid = f"BEN-{idx:05d}"
            enroll_date = rand_date(START, START + timedelta(days=30))
            # Status distribution: high-risk cohorts have more dropouts/at-risk
            if is_high_risk:
                status = random.choices(
                    ENGAGEMENT_LEVELS,
                    weights=[0.35, 0.30, 0.20, 0.15]
                )[0]
            else:
                status = random.choices(
                    ENGAGEMENT_LEVELS,
                    weights=[0.60, 0.22, 0.12, 0.06]
                )[0]

            dropout_date = None
            dropout_reason = None
            if status == "Dropout":
                dropout_date = rand_date(
                    enroll_date + timedelta(days=30),
                    TODAY - timedelta(days=7),
                ).strftime("%Y-%m-%d")
                dropout_reason = random.choice(DROPOUT_REASONS)

            beneficiaries.append({
                "beneficiary_id":   bid,
                "full_name":        ke_name(),
                "cohort_id":        cohort["cohort_id"],
                "pillar":           cohort["pillar"],
                "county":           cohort["county"],
                "gender":           random.choice(["Female", "Male", "Prefer not to say"]),
                "age":              random.randint(16, 28),
                "enrollment_date":  enroll_date.strftime("%Y-%m-%d"),
                "current_status":   status,
                "dropout_date":     dropout_date,
                "dropout_reason":   dropout_reason,
                "phone":            f"+2547{random.randint(10000000, 99999999)}",
            })
            idx += 1
    return beneficiaries


# ============================================================================
# 3. fact_sessions — weekly attendance events
# ============================================================================

def build_sessions(beneficiaries: list[dict]) -> list[dict]:
    sessions = []
    sid = 1
    for ben in beneficiaries:
        enroll = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d")
        end_date = TODAY
        if ben["dropout_date"]:
            end_date = datetime.strptime(ben["dropout_date"], "%Y-%m-%d")

        # Generate weekly session slots
        cursor = enroll
        is_high_risk = ben["cohort_id"] in HIGH_RISK_COHORTS
        while cursor <= end_date:
            session_id = f"SES-{sid:07d}"
            # Attendance probability: high-risk cohorts skip more
            base_attend = 0.55 if is_high_risk else 0.82
            if ben["current_status"] == "Disengaged":
                base_attend *= 0.5
            elif ben["current_status"] == "At-Risk":
                base_attend *= 0.7

            attended = random.random() < base_attend
            attendance_val = "Present" if attended else "Absent"

            # Inject dirty labels ~8% of the time
            attendance_label = dirty_label(
                attendance_val,
                {"present": "Present", "absent": "Absent", "YES": "Present",
                 "NO": "Absent", "1": "Present", "0": "Absent"},
                session_id, "fact_sessions", "attendance_status",
            )

            sessions.append({
                "session_id":        session_id,
                "beneficiary_id":    ben["beneficiary_id"],
                "cohort_id":         ben["cohort_id"],
                "session_date":      dirty_date(cursor, session_id,
                                                "fact_sessions", "session_date"),
                "attendance_status": attendance_label,
                "session_type":      random.choice(["Workshop", "Mentorship",
                                                     "Skills Lab", "Group Discussion"]),
                "facilitator":       maybe_missing(ke_name(), session_id,
                                                   "fact_sessions", "facilitator"),
            })
            sid += 1
            cursor += timedelta(weeks=1)

    return sessions


# ============================================================================
# 4. fact_field_visits — field officer verification visits
# ============================================================================

def build_field_visits(beneficiaries: list[dict]) -> list[dict]:
    visits = []
    vid = 1
    # One or two visits per active/at-risk beneficiary over 6 months
    for ben in beneficiaries:
        if ben["current_status"] == "Dropout":
            continue

        is_high_risk = ben["cohort_id"] in HIGH_RISK_COHORTS
        n_visits = random.choices(
            [0, 1, 2, 3],
            weights=[0.30, 0.40, 0.20, 0.10] if is_high_risk
                    else [0.10, 0.45, 0.35, 0.10]
        )[0]

        for _ in range(n_visits):
            fvid = f"FV-{vid:06d}"
            visit_date = rand_date(START, TODAY - timedelta(days=1))
            outcome_val = random.choices(
                VISIT_OUTCOMES,
                weights=[0.30, 0.25, 0.30, 0.15] if is_high_risk
                        else [0.65, 0.20, 0.10, 0.05]
            )[0]

            outcome_label = dirty_label(
                outcome_val,
                {"verified": "Verified", "no contact": "No Contact",
                 "partial": "Partially Verified"},
                fvid, "fact_field_visits", "visit_outcome",
            )

            visits.append({
                "visit_id":          fvid,
                "beneficiary_id":    ben["beneficiary_id"],
                "cohort_id":         ben["cohort_id"],
                "visit_date":        dirty_date(visit_date, fvid,
                                                "fact_field_visits", "visit_date"),
                "officer_name":      ke_name(),
                "visit_outcome":     outcome_label,
                "gps_latitude":      maybe_missing(
                                         round(COUNTY_COORDS[ben["county"]][0] +
                                               random.uniform(-0.1, 0.1), 5),
                                         fvid, "fact_field_visits", "gps_latitude"),
                "gps_longitude":     round(COUNTY_COORDS[ben["county"]][1] +
                                           random.uniform(-0.1, 0.1), 5),
                "notes":             fake.sentence(nb_words=8),
                "follow_up_required": random.choice([True, False, None]),
            })
            vid += 1

    return visits


# ============================================================================
# 5. fact_disbursements — monthly stipend payments
# ============================================================================

def build_disbursements(beneficiaries: list[dict]) -> list[dict]:
    disbursements = []
    did = 1
    months = pd.date_range(start=START, end=TODAY, freq="MS").to_pydatetime().tolist()

    for ben in beneficiaries:
        is_high_risk = ben["cohort_id"] in HIGH_RISK_COHORTS
        enroll = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d")

        for month_start in months:
            if month_start < enroll:
                continue
            if ben["dropout_date"]:
                drop = datetime.strptime(ben["dropout_date"], "%Y-%m-%d")
                if month_start > drop:
                    break

            disb_id = f"DISB-{did:07d}"
            amount_kes = random.randint(3000, 8000)

            # High-risk cohorts have more delays/withholdings
            if is_high_risk:
                status = random.choices(
                    DISBURSEMENT_STATUSES,
                    weights=[0.40, 0.25, 0.25, 0.10]
                )[0]
            else:
                status = random.choices(
                    DISBURSEMENT_STATUSES,
                    weights=[0.70, 0.15, 0.10, 0.05]
                )[0]

            # Delay days
            expected_date = month_start + timedelta(days=5)
            delay_days = 0
            actual_date = expected_date
            if status == "Delayed":
                delay_days = random.randint(7, 30)
                actual_date = expected_date + timedelta(days=delay_days)
            elif status == "Withheld":
                actual_date = None

            # Inject out-of-range amount
            amount_kes = out_of_range_score(
                amount_kes, disb_id, "fact_disbursements", "amount_kes", prob=0.02
            )

            disbursements.append({
                "disbursement_id":    disb_id,
                "beneficiary_id":     ben["beneficiary_id"],
                "cohort_id":          ben["cohort_id"],
                "expected_date":      expected_date.strftime("%Y-%m-%d"),
                "actual_date":        actual_date.strftime("%Y-%m-%d")
                                      if actual_date else None,
                "amount_kes":         round(amount_kes),
                "status":             dirty_label(
                                          status,
                                          {"paid": "Paid", "PAID": "Paid",
                                           "delayed": "Delayed", "withheld": "Withheld"},
                                          disb_id, "fact_disbursements", "status"),
                "delay_days":         delay_days if status in ("Delayed", "Withheld") else 0,
                "payment_method":     random.choice(["M-Pesa", "Bank Transfer", "Cash"]),
            })
            did += 1

    return disbursements


# ============================================================================
# 6. fact_assessments — quarterly score snapshots
# ============================================================================

def build_assessments(beneficiaries: list[dict]) -> list[dict]:
    assessments = []
    aid = 1
    # Two assessment windows per beneficiary (~3 months apart)
    for ben in beneficiaries:
        if ben["current_status"] == "Dropout":
            continue

        is_high_risk = ben["cohort_id"] in HIGH_RISK_COHORTS
        enroll = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d")

        for wave in range(2):
            assess_date = enroll + timedelta(days=90 * (wave + 1))
            if assess_date > TODAY:
                continue

            assmt_id = f"ASMT-{aid:06d}"
            base = random.gauss(55 if is_high_risk else 72, 15)
            score = round(max(0, min(100, base)), 1)

            # Inject out-of-range
            score = out_of_range_score(
                score, assmt_id, "fact_assessments", "score", prob=0.025
            )

            assessments.append({
                "assessment_id":   assmt_id,
                "beneficiary_id":  ben["beneficiary_id"],
                "cohort_id":       ben["cohort_id"],
                "assessment_date": dirty_date(assess_date, assmt_id,
                                              "fact_assessments", "assessment_date"),
                "wave":            wave + 1,
                "score":           score,
                "max_score":       100,
                "assessor":        maybe_missing(ke_name(), assmt_id,
                                                 "fact_assessments", "assessor"),
                "subject":         random.choice(["Numeracy", "Literacy",
                                                  "Technical Skills", "Life Skills"]),
            })
            aid += 1

    return assessments


# ============================================================================
# 7. Write documentation
# ============================================================================

NOTES = """\
# Inuka Pulse — Data Generation Notes

## Design Choices

### High-Risk Cohorts
Two cohorts are seeded with weak-engagement patterns (mirrors KPC's Makueni/Sinendet):

| Cohort ID       | Pillar     | County  | Pattern                                              |
|-----------------|------------|---------|------------------------------------------------------|
| COHORT-VN-003   | Vocational | Nakuru  | High dropout rate, low session attendance (55%)       |
| COHORT-TC-007   | Tech       | Kisumu  | Frequent disbursement delays, lower assessment scores |

### Injected Data Quality Issues
Every issue is logged to `ground_truth_issues.csv` for detection-rate calculation.

| Issue Type              | Rate  | Outcome            |
|-------------------------|-------|--------------------|
| `mixed_date_format`     | ~10%  | Corrected          |
| `dirty_label`           | ~8%   | Corrected          |
| `missing_required_field`| ~3%   | Review             |
| `out_of_range`          | ~2.5% | Rejected/Corrected |
| `future_date`           | ~4%   | Rejected           |

### Volume
- ~2 000 beneficiaries
- ~52 000 session attendance events (weekly × 26 weeks)
- ~3 500 field visits
- ~12 000 disbursement records
- ~4 000 assessment records
"""


# ============================================================================
# Main
# ============================================================================

def main():
    print("Inuka Pulse — Synthetic Data Generator")
    print("=" * 50)

    print("Building cohorts…")
    cohorts = build_cohorts()

    print("Building beneficiaries…")
    beneficiaries = build_beneficiaries(cohorts)

    print(f"Building sessions for {len(beneficiaries)} beneficiaries…")
    sessions = build_sessions(beneficiaries)

    print("Building field visits…")
    field_visits = build_field_visits(beneficiaries)

    print("Building disbursements…")
    disbursements = build_disbursements(beneficiaries)

    print("Building assessments…")
    assessments = build_assessments(beneficiaries)

    # ── Write CSVs ────────────────────────────────────────────────────────────
    datasets = {
        "dim_cohort.csv":           cohorts,
        "dim_beneficiary.csv":      beneficiaries,
        "fact_sessions.csv":        sessions,
        "fact_field_visits.csv":    field_visits,
        "fact_disbursements.csv":   disbursements,
        "fact_assessments.csv":     assessments,
        "ground_truth_issues.csv":  issue_log,
    }

    for fname, rows in datasets.items():
        if not rows:
            print(f"  SKIP {fname} (empty)")
            continue
        df = pd.DataFrame(rows)
        path = OUT_DIR / fname
        df.to_csv(path, index=False)
        print(f"  {fname}: {len(df):>6,} rows → {path}")

    # ── Write docs ────────────────────────────────────────────────────────────
    notes_path = DOCS_DIR / "inuka_data_generation_notes.md"
    notes_path.write_text(NOTES)
    print(f"  Docs → {notes_path}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print(f"Beneficiaries : {len(beneficiaries):>6,}")
    print(f"Sessions      : {len(sessions):>6,}")
    print(f"Field visits  : {len(field_visits):>6,}")
    print(f"Disbursements : {len(disbursements):>6,}")
    print(f"Assessments   : {len(assessments):>6,}")
    print(f"Issues logged : {len(issue_log):>6,}")

    # Dropout stats
    dropout_count = sum(1 for b in beneficiaries if b["current_status"] == "Dropout")
    at_risk_count = sum(1 for b in beneficiaries if b["current_status"] == "At-Risk")
    high_risk_bens = sum(1 for b in beneficiaries if b["cohort_id"] in HIGH_RISK_COHORTS)
    print(f"\nDropouts      : {dropout_count:>6,} ({dropout_count/len(beneficiaries)*100:.1f}%)")
    print(f"At-Risk       : {at_risk_count:>6,} ({at_risk_count/len(beneficiaries)*100:.1f}%)")
    print(f"High-risk cohort beneficiaries: {high_risk_bens}")
    print("=" * 50)
    print("Done. Output in data/raw/inuka/")


if __name__ == "__main__":
    main()
