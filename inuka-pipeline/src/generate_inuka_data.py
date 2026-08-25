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
START = TODAY - timedelta(days=364)   # 12-month window (~52 weeks)

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

# ── Trajectory types for time-varying engagement ──────────────────────────────
TRAJECTORY_TYPES = ["stable_active", "gradual_decline", "sudden_dropout",
                    "chronic_at_risk", "recovering"]

BAND_ORDER = ["Active", "At-Risk", "Disengaged", "Dropout"]


def _build_trajectory_by_type(ttype: str, n_weeks: int = 52) -> list[str]:
    """
    Build a specific trajectory type. Called by build_trajectory after
    the type is randomly selected.
    """
    if ttype == "stable_active":
        return ["Active"] * n_weeks

    if ttype == "chronic_at_risk":
        settle = random.randint(3, 6)
        return ["Active"] * settle + ["At-Risk"] * (n_weeks - settle)

    if ttype == "recovering":
        d1 = random.randint(3, 6)
        d2 = random.randint(3, 6)
        remaining = n_weeks - d1 - d2
        if remaining < 0:
            remaining = 0
            d2 = n_weeks - d1
        return ["Active"] * d1 + ["At-Risk"] * d2 + ["Active"] * remaining

    if ttype == "sudden_dropout":
        pre = n_weeks - random.randint(2, 4)
        at_risk_weeks = n_weeks - pre - 1
        if at_risk_weeks < 1:
            at_risk_weeks = 1
            pre = n_weeks - 2
        return ["Active"] * pre + ["At-Risk"] * at_risk_weeks + ["Dropout"]

    if ttype == "gradual_decline":
        dwell = [random.randint(8, 16), random.randint(6, 12), random.randint(4, 8)]
        bands = []
        for band, d in zip(BAND_ORDER[:3], dwell):
            bands += [band] * d
            if len(bands) >= n_weeks:
                return bands[:n_weeks]
        bands += ["Dropout"] * (n_weeks - len(bands))
        return bands[:n_weeks]

    # Fallback
    return ["Active"] * n_weeks


def build_trajectory(is_high_risk: bool, n_weeks: int = 52) -> list[str]:
    """
    Generate a per-beneficiary weekly engagement trajectory.
    High-risk cohorts have higher probability of decline/dropout trajectories.
    """
    weights = ([0.30, 0.35, 0.18, 0.12, 0.05] if is_high_risk
               else [0.60, 0.15, 0.08, 0.12, 0.05])
    ttype = random.choices(TRAJECTORY_TYPES, weights=weights)[0]
    return _build_trajectory_by_type(ttype, n_weeks)


def build_engagement_history(beneficiaries: list[dict]) -> list[dict]:
    """
    Expand each beneficiary's trajectory into weekly (beneficiary_id, week_start, band) records.
    This is the ground-truth table the escalation label will be built from.
    """
    history = []
    for ben in beneficiaries:
        enroll_date = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d").date()
        trajectory = ben["trajectory"]
        
        for week_idx, band in enumerate(trajectory):
            week_start = enroll_date + timedelta(weeks=week_idx)
            history.append({
                "beneficiary_id": ben["beneficiary_id"],
                "week_start": week_start.strftime("%Y-%m-%d"),
                "band": band,
            })
    
    return history


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
        n = random.randint(220, 320) if is_high_risk else random.randint(260, 380)
        for _ in range(n):
            bid = f"BEN-{idx:05d}"
            enroll_date = rand_date(START, START + timedelta(days=30))

            # Generate trajectory; current_status = final week's band
            trajectory = build_trajectory(is_high_risk, n_weeks=52)
            status = trajectory[-1]

            dropout_date = None
            dropout_reason = None
            if status == "Dropout":
                # Find first week where band became Dropout
                dropout_week = next((i for i, b in enumerate(trajectory) if b == "Dropout"), len(trajectory) - 1)
                dropout_date = enroll_date + timedelta(weeks=dropout_week)
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
                "dropout_date":     dropout_date.strftime("%Y-%m-%d") if dropout_date else None,
                "dropout_reason":   dropout_reason,
                "phone":            f"+2547{random.randint(10000000, 99999999)}",
                "trajectory":       trajectory,
            })
            idx += 1
    return beneficiaries


# ============================================================================
# 3. fact_sessions — weekly attendance events
# ============================================================================

def build_sessions(beneficiaries: list[dict]) -> list[dict]:
    sessions = []
    sid = 1

    # Band-based attendance probabilities
    BAND_ATTEND_RATES = {
        "Active": 0.88,
        "At-Risk": 0.65,
        "Disengaged": 0.35,
        "Dropout": 0.05,
    }

    for ben in beneficiaries:
        enroll = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d")
        enroll_date = enroll.date()
        end_date = TODAY
        if ben["dropout_date"]:
            end_date = datetime.strptime(ben["dropout_date"], "%Y-%m-%d")

        # Get trajectory (fallback to static status if missing)
        trajectory = ben.get("trajectory", [ben["current_status"]] * 26)
        is_high_risk = ben["cohort_id"] in HIGH_RISK_COHORTS

        # Generate weekly session slots
        cursor = enroll
        while cursor <= end_date:
            session_id = f"SES-{sid:07d}"
            session_date = cursor.date()

            # Determine which week this session falls in
            weeks_since_enroll = (session_date - enroll_date).days // 7
            week_idx = min(weeks_since_enroll, len(trajectory) - 1)
            week_idx = max(0, week_idx)
            current_band = trajectory[week_idx]

            # Attendance probability based on current band
            base_attend = BAND_ATTEND_RATES.get(current_band, 0.50)

            # High-risk cohorts have slightly lower baseline
            if is_high_risk:
                base_attend *= 0.92

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

    # Outcome weights by band
    BAND_OUTCOME_WEIGHTS = {
        "Active":     [0.70, 0.18, 0.07, 0.05],  # Verified, Partial, No Contact, Referred
        "At-Risk":    [0.45, 0.25, 0.20, 0.10],
        "Disengaged": [0.25, 0.25, 0.35, 0.15],
        "Dropout":    [0.10, 0.15, 0.60, 0.15],
    }

    # Visit count weights by band
    BAND_VISIT_WEIGHTS = {
        "Active":     [0.10, 0.45, 0.35, 0.10],
        "At-Risk":    [0.15, 0.40, 0.30, 0.15],
        "Disengaged": [0.30, 0.40, 0.20, 0.10],
        "Dropout":    [0.50, 0.35, 0.10, 0.05],
    }

    for ben in beneficiaries:
        trajectory = ben.get("trajectory", [ben["current_status"]] * 26)
        enroll_date = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d").date()
        is_high_risk = ben["cohort_id"] in HIGH_RISK_COHORTS

        # Find last engaged week (before Dropout)
        last_engaged_week = len(trajectory)
        for i, band in enumerate(trajectory):
            if band == "Dropout":
                last_engaged_week = i
                break

        # Skip if they dropped out immediately
        if last_engaged_week == 0:
            continue

        # Calculate the date range for visits
        end_visit_date = min(TODAY.date(), enroll_date + timedelta(weeks=last_engaged_week))
        if end_visit_date <= START.date():
            continue

        # Use average band over their engaged period for visit count
        engaged_bands = trajectory[:last_engaged_week] if last_engaged_week > 0 else trajectory[:1]
        avg_band = max(set(engaged_bands), key=engaged_bands.count)  # Mode of bands

        visit_weights = BAND_VISIT_WEIGHTS.get(avg_band, [0.20, 0.40, 0.25, 0.15])
        if is_high_risk:
            # Shift weights toward fewer visits for high-risk
            visit_weights = [w * 1.2 if i < 2 else w * 0.8 for i, w in enumerate(visit_weights)]

        n_visits = random.choices([0, 1, 2, 3], weights=visit_weights)[0]

        for _ in range(n_visits):
            fvid = f"FV-{vid:06d}"
            visit_date_dt = rand_date(START, datetime.combine(end_visit_date, datetime.min.time()) - timedelta(days=1))
            visit_date = visit_date_dt.date()

            # Determine the band at visit time
            weeks_since_enroll = (visit_date - enroll_date).days // 7
            week_idx = min(weeks_since_enroll, len(trajectory) - 1)
            week_idx = max(0, week_idx)
            current_band = trajectory[week_idx]

            outcome_weights = BAND_OUTCOME_WEIGHTS.get(current_band, [0.45, 0.25, 0.20, 0.10])
            if is_high_risk:
                # Shift toward worse outcomes for high-risk
                outcome_weights = [outcome_weights[0] * 0.7, outcome_weights[1],
                                   outcome_weights[2] * 1.3, outcome_weights[3] * 1.2]

            outcome_val = random.choices(VISIT_OUTCOMES, weights=outcome_weights)[0]

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
                "visit_date":        dirty_date(visit_date_dt, fvid,
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
        trajectory = ben.get("trajectory", [ben["current_status"]] * 26)
        enroll = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d")
        enroll_date = enroll.date()
        is_high_risk = ben["cohort_id"] in HIGH_RISK_COHORTS

        # Find last week before dropout (or all weeks if never dropped)
        last_engaged_week = len(trajectory)
        for i, band in enumerate(trajectory):
            if band == "Dropout":
                last_engaged_week = i
                break

        # Skip if they dropped out immediately (no time for assessment)
        if last_engaged_week == 0:
            continue

        for wave in range(2):
            assess_date = enroll + timedelta(days=90 * (wave + 1))
            if assess_date > TODAY:
                continue

            # Check if assessment falls before dropout
            weeks_since_enroll = (assess_date.date() - enroll_date).days // 7
            if weeks_since_enroll >= last_engaged_week:
                # Beneficiary had already dropped out by assessment time
                continue

            assmt_id = f"ASMT-{aid:06d}"

            # Score influenced by band at assessment time
            week_idx = min(weeks_since_enroll, len(trajectory) - 1)
            week_idx = max(0, week_idx)
            current_band = trajectory[week_idx]

            # Base score varies by band
            BAND_SCORE_MEAN = {
                "Active": 75,
                "At-Risk": 60,
                "Disengaged": 45,
                "Dropout": 35,
            }
            base_mean = BAND_SCORE_MEAN.get(current_band, 55)
            if is_high_risk:
                base_mean -= 8

            base = random.gauss(base_mean, 15)
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

    # 2a. fact_engagement_history — weekly band snapshots per beneficiary
    engagement_history = build_engagement_history(beneficiaries)
    pd.DataFrame(engagement_history).to_csv(
        OUT_DIR / "fact_engagement_history.csv", index=False
    )
    print(f"  fact_engagement_history.csv: {len(engagement_history):,} rows")

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
