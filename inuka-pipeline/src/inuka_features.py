"""
Inuka Pulse — Feature Engineering
===================================
Produces fact_beneficiary_features.parquet: one row per (beneficiary_id, as_of_date).

Each row is a weekly snapshot of lagging engagement indicators for a beneficiary.
This is the single input to both the predictive model and the statistical diagnostics.

Output schema:
  beneficiary_id              TEXT    e.g. "BEN-00042"
  cohort_id                   TEXT    e.g. "COHORT-VN-003"
  pillar                      TEXT    Scholarship / Plus / Vocational / Tech
  county                      TEXT
  as_of_date                  DATE
  days_since_last_contact     INT     days since last field visit or session
  sessions_attended_30d       INT     sessions attended in last 30 days
  sessions_total_30d          INT     total sessions scheduled in last 30 days
  attendance_rate_30d         FLOAT   sessions_attended_30d / sessions_total_30d
  missed_sessions_14d         INT     sessions missed in last 14 days
  disbursement_delay_days     INT     avg delay days of disbursements in last 60d
  missed_disbursements_60d    INT     withheld/pending disbursements in last 60d
  assessment_score_latest     FLOAT   most recent assessment score (NULL if none)
  assessment_score_trend      FLOAT   wave2 - wave1 score; NULL if only one wave
  field_visit_gap_days        INT     days since last field visit (999 if never)
  no_contact_visits_90d       INT     "No Contact" field visit outcomes in 90d

Data Sources:
  - File mode (default): Reads from data/raw/inuka/*.csv
  - PostgreSQL mode: Reads from Railway PostgreSQL when PIPELINE_MODE=postgres

Usage:
    cd inuka-pipeline
    python -m src.inuka_features                 # default 180-day window (file mode)
    python -m src.inuka_features --days-back 90
    
    # With PostgreSQL:
    export PIPELINE_MODE=postgres
    export DATABASE_URL=postgresql://...
    python -m src.inuka_features
"""

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# Database module for PostgreSQL support
try:
    from src.db import is_postgres_mode, get_engine, print_db_status
except ImportError:
    # Fallback if running as script directly
    from db import is_postgres_mode, get_engine, print_db_status

RAW_DIR       = Path("data/raw/inuka")
WAREHOUSE_DIR = Path("data/warehouse")
WAREHOUSE_DIR.mkdir(parents=True, exist_ok=True)


# ── Safe CSV loading with error handling ──────────────────────────────────────

def _load_csv(path: Path, required: bool = True) -> Optional[pd.DataFrame]:
    """
    Load a CSV file with existence check and error handling.
    
    Args:
        path: Path to the CSV file.
        required: If True, raises FileNotFoundError when file is missing.
                  If False, returns None and logs a warning.
    
    Returns:
        DataFrame or None if file is missing and not required.
    
    Raises:
        FileNotFoundError: If required file is missing.
        RuntimeError: If file exists but cannot be parsed.
    """
    if not path.exists():
        if required:
            raise FileNotFoundError(
                f"Required file missing: {path}\n"
                f"Ensure the raw data has been loaded before running feature engineering."
            )
        print(f"  Warning: optional file missing: {path}")
        return None
    try:
        return pd.read_csv(path)
    except Exception as e:
        raise RuntimeError(f"Failed to parse {path}: {e}") from e


# ── PostgreSQL data loading ───────────────────────────────────────────────────

def _load_beneficiaries_from_db() -> pd.DataFrame:
    """Load beneficiary dimension data from PostgreSQL."""
    query = """
    SELECT DISTINCT ON (bp.beneficiary_id)
        bp.beneficiary_id,
        bp.cohort_id,
        bp.pillar,
        ds.county,
        bp.predicted_band AS current_status
    FROM beneficiary_prediction bp
    LEFT JOIN dim_site ds ON bp.cohort_id = ds.site_id
    ORDER BY bp.beneficiary_id, bp.as_of_date DESC
    """
    try:
        return pd.read_sql(query, get_engine())
    except Exception as e:
        print(f"  Warning: Could not load beneficiaries from DB: {e}")
        # Fallback: try simpler query without join
        simple_query = """
        SELECT DISTINCT ON (beneficiary_id)
            beneficiary_id,
            cohort_id,
            pillar,
            county,
            predicted_band AS current_status
        FROM beneficiary_prediction
        ORDER BY beneficiary_id, as_of_date DESC
        """
        return pd.read_sql(simple_query, get_engine())


def _load_incidents_as_sessions_from_db() -> pd.DataFrame:
    """
    Load incidents from PostgreSQL and convert to session-like records.
    
    The backend stores incidents (from ML predictions), not raw sessions.
    We use incident data as a proxy for engagement activity.
    """
    query = """
    SELECT 
        fi.beneficiary_id,
        fi.incident_date::date AS session_date,
        CASE 
            WHEN fi.status = 'Resolved' THEN 'Present'
            ELSE 'Absent'
        END AS attendance_status
    FROM fact_incidents fi
    WHERE fi.beneficiary_id IS NOT NULL
    ORDER BY fi.incident_date
    """
    try:
        return pd.read_sql(query, get_engine())
    except Exception as e:
        print(f"  Warning: Could not load incidents as sessions from DB: {e}")
        return pd.DataFrame(columns=["beneficiary_id", "session_date", "attendance_status"])


def _load_audits_as_field_visits_from_db() -> pd.DataFrame:
    """Load audits from PostgreSQL as field visit records."""
    query = """
    SELECT 
        fa.audit_id AS visit_id,
        bp.beneficiary_id,
        fa.site_id AS cohort_id,
        fa.inspection_date::date AS visit_date,
        fa.auditor AS officer_name,
        CASE 
            WHEN fa.findings LIKE '%No Contact%' THEN 'No Contact'
            ELSE 'Completed'
        END AS visit_outcome
    FROM fact_audits fa
    LEFT JOIN beneficiary_prediction bp ON fa.site_id = bp.cohort_id
    ORDER BY fa.inspection_date
    """
    try:
        df = pd.read_sql(query, get_engine())
        # If no beneficiary join worked, just return site-level audits
        if df.empty or df["beneficiary_id"].isna().all():
            simple_query = """
            SELECT 
                audit_id AS visit_id,
                site_id AS cohort_id,
                inspection_date::date AS visit_date,
                auditor AS officer_name,
                CASE 
                    WHEN findings LIKE '%No Contact%' THEN 'No Contact'
                    ELSE 'Completed'
                END AS visit_outcome
            FROM fact_audits
            ORDER BY inspection_date
            """
            return pd.read_sql(simple_query, get_engine())
        return df
    except Exception as e:
        print(f"  Warning: Could not load audits from DB: {e}")
        return pd.DataFrame(columns=["visit_id", "beneficiary_id", "cohort_id", "visit_date", "officer_name", "visit_outcome"])

FEATURES = [
    "days_since_last_contact",
    "sessions_attended_30d",
    "sessions_total_30d",
    "attendance_rate_30d",
    "missed_sessions_14d",
    "disbursement_delay_days",
    "missed_disbursements_60d",
    "assessment_score_latest",
    "assessment_score_trend",
    "field_visit_gap_days",
    "no_contact_visits_90d",
    "band_now",
]


# ── Date parsing ──────────────────────────────────────────────────────────────

def _parse_dates(series: pd.Series) -> pd.Series:
    """Parse dates tolerantly (ISO, d/m/Y, d-Mon-Y)."""
    return pd.to_datetime(series, errors="coerce", dayfirst=True)


def _compute_assessment_score_as_of(
    ben_assessments: pd.DataFrame,
    as_of_date: date,
) -> tuple[float, float]:
    """
    Compute assessment scores for a beneficiary as of a specific date.
    
    CRITICAL: This function only considers assessments taken BEFORE as_of_date
    to prevent future data leakage into historical snapshots.
    
    Args:
        ben_assessments: DataFrame of assessments for a single beneficiary
                        with columns ['assessment_date', 'score'].
        as_of_date: The snapshot date — only assessments before this date count.
    
    Returns:
        Tuple of (score_latest, score_trend):
        - score_latest: Most recent assessment score before as_of_date (NaN if none)
        - score_trend: Difference between latest and earliest scores (NaN if < 2 assessments)
    """
    if ben_assessments.empty:
        return np.nan, np.nan
    
    # Filter to only assessments taken before the snapshot date
    past_assessments = ben_assessments[ben_assessments["assessment_date"] <= as_of_date]
    
    if past_assessments.empty:
        return np.nan, np.nan
    
    # Sort by date to get chronological order
    past_sorted = past_assessments.sort_values("assessment_date")
    scores = past_sorted["score"].dropna().tolist()
    
    if not scores:
        return np.nan, np.nan
    
    score_latest = scores[-1]
    score_trend = scores[-1] - scores[0] if len(scores) >= 2 else np.nan
    
    return score_latest, score_trend


# ── Main feature computation ──────────────────────────────────────────────────

def build_features(days_back: int = 364) -> pd.DataFrame:
    """
    Build a feature snapshot for every (beneficiary, week) in the window.
    Returns a DataFrame ready to be written to Parquet.
    
    Supports two data source modes:
      - File mode (default): Reads from data/raw/inuka/*.csv
      - PostgreSQL mode: Reads from Railway PostgreSQL when PIPELINE_MODE=postgres
    
    Raises:
        FileNotFoundError: If required raw data files are missing (file mode only).
        RuntimeError: If raw data files cannot be parsed.
    """
    today = date.today()
    window_start = today - timedelta(days=days_back)
    
    # Check if we're in PostgreSQL mode
    use_postgres = False
    try:
        use_postgres = is_postgres_mode()
    except Exception:
        pass
    
    if use_postgres:
        print("  Data source: PostgreSQL (Railway)")
        return _build_features_from_postgres(days_back, today, window_start)
    else:
        print("  Data source: CSV files")
        return _build_features_from_csv(days_back, today, window_start)


def _build_features_from_postgres(days_back: int, today: date, window_start: date) -> pd.DataFrame:
    """Build features from PostgreSQL data source."""
    
    # Load data from PostgreSQL
    print("  Loading data from PostgreSQL...")
    beneficiaries = _load_beneficiaries_from_db()
    
    if beneficiaries.empty:
        print("  Warning: No beneficiaries found in database. Falling back to CSV.")
        return _build_features_from_csv(days_back, today, window_start)
    
    print(f"  Loaded {len(beneficiaries):,} beneficiaries from database")
    
    # For PostgreSQL mode, we generate simpler features based on available data
    # The backend stores predictions, not raw engagement data, so we use what's available
    
    rows = []
    weekly_dates = pd.date_range(
        start=pd.Timestamp(window_start),
        end=pd.Timestamp(today),
        freq="W-MON"
    )
    
    # Load audits for field visit features
    audits = _load_audits_as_field_visits_from_db()
    if not audits.empty and "visit_date" in audits.columns:
        audits["visit_date"] = pd.to_datetime(audits["visit_date"]).dt.date
    
    for _, ben in beneficiaries.iterrows():
        bid = ben["beneficiary_id"]
        cid = ben.get("cohort_id", "")
        pillar = ben.get("pillar", "Unknown")
        county = ben.get("county", "Unknown")
        
        # Get audits for this beneficiary's cohort
        if not audits.empty and "cohort_id" in audits.columns:
            ben_visits = audits[audits["cohort_id"] == cid]
        else:
            ben_visits = pd.DataFrame()
        
        for snap_ts in weekly_dates:
            snap = snap_ts.date()
            
            # Field visit features from audits
            if not ben_visits.empty and "visit_date" in ben_visits.columns:
                past_visits = ben_visits[ben_visits["visit_date"] <= snap]
                if past_visits.empty:
                    field_visit_gap_days = 999
                else:
                    last_visit = past_visits["visit_date"].max()
                    field_visit_gap_days = (snap - last_visit).days
                
                # No contact visits in 90 days
                d90_start = snap - timedelta(days=90)
                v90 = ben_visits[
                    (ben_visits["visit_date"] >= d90_start) &
                    (ben_visits["visit_date"] <= snap)
                ]
                if "visit_outcome" in v90.columns:
                    no_contact_visits_90d = int((v90["visit_outcome"] == "No Contact").sum())
                else:
                    no_contact_visits_90d = 0
            else:
                field_visit_gap_days = 999
                no_contact_visits_90d = 0
            
            # Days since last contact (use field visit gap as proxy)
            days_since_last_contact = field_visit_gap_days
            
            # For PostgreSQL mode, we don't have raw session/disbursement/assessment data
            # Use neutral defaults that won't skew the model
            rows.append({
                "beneficiary_id": bid,
                "cohort_id": cid,
                "pillar": pillar,
                "county": county,
                "as_of_date": snap,
                "days_since_last_contact": days_since_last_contact,
                "sessions_attended_30d": 0,  # Not available from DB
                "sessions_total_30d": 0,
                "attendance_rate_30d": np.nan,
                "missed_sessions_14d": 0,
                "disbursement_delay_days": 0.0,
                "missed_disbursements_60d": 0,
                "assessment_score_latest": np.nan,
                "assessment_score_trend": np.nan,
                "field_visit_gap_days": field_visit_gap_days,
                "no_contact_visits_90d": no_contact_visits_90d,
                "band_now": ben.get("current_status"),
            })
    
    return pd.DataFrame(rows)


def _build_features_from_csv(days_back: int, today: date, window_start: date) -> pd.DataFrame:
    """Build features from CSV files (original implementation)."""

    # ── Load raw tables (with error handling) ─────────────────────────────────
    print("  Loading raw data files...")
    beneficiaries     = _load_csv(RAW_DIR / "dim_beneficiary.csv", required=True)
    sessions_raw      = _load_csv(RAW_DIR / "fact_sessions.csv", required=True)
    visits_raw        = _load_csv(RAW_DIR / "fact_field_visits.csv", required=True)
    disbursements_raw = _load_csv(RAW_DIR / "fact_disbursements.csv", required=True)
    assessments_raw   = _load_csv(RAW_DIR / "fact_assessments.csv", required=True)
    
    # Validate minimum required columns
    required_ben_cols = {"beneficiary_id", "cohort_id", "pillar", "county"}
    if not required_ben_cols.issubset(beneficiaries.columns):
        missing = required_ben_cols - set(beneficiaries.columns)
        raise RuntimeError(f"dim_beneficiary.csv missing required columns: {missing}")
    
    print(f"  Loaded {len(beneficiaries):,} beneficiaries")

    # Load engagement history for band_now lookup (optional)
    engagement_history = _load_csv(RAW_DIR / "fact_engagement_history.csv", required=False)
    if engagement_history is not None:
        engagement_history["week_start"] = pd.to_datetime(engagement_history["week_start"])
        # Pre-group by beneficiary for efficient lookup
        engagement_by_ben: dict[str, pd.DataFrame] = dict(tuple(engagement_history.groupby("beneficiary_id")))
    else:
        engagement_by_ben = {}

    # ── Parse & clean dates ───────────────────────────────────────────────────
    sessions_raw["session_date"]   = _parse_dates(sessions_raw["session_date"])
    visits_raw["visit_date"]       = _parse_dates(visits_raw["visit_date"])
    disbursements_raw["expected_date"] = _parse_dates(disbursements_raw["expected_date"])
    assessments_raw["assessment_date"] = _parse_dates(assessments_raw["assessment_date"])

    # Drop rows with unparseable dates
    sessions      = sessions_raw.dropna(subset=["session_date"]).copy()
    visits        = visits_raw.dropna(subset=["visit_date"]).copy()
    disbursements = disbursements_raw.dropna(subset=["expected_date"]).copy()
    assessments   = assessments_raw.dropna(subset=["assessment_date"]).copy()

    # Convert to date only
    sessions["session_date"]       = sessions["session_date"].dt.date
    visits["visit_date"]           = visits["visit_date"].dt.date
    disbursements["expected_date"] = disbursements["expected_date"].dt.date
    assessments["assessment_date"] = assessments["assessment_date"].dt.date

    # Normalise attendance status
    ATTEND_PRESENT = {"Present", "present", "1", "YES", "yes"}
    sessions["is_present"] = sessions["attendance_status"].isin(ATTEND_PRESENT)

    # Normalise visit outcome
    NO_CONTACT_VARIANTS = {"No Contact", "no contact"}
    visits["is_no_contact"] = visits["visit_outcome"].isin(NO_CONTACT_VARIANTS)

    # Cap delay_days at 0 (negatives are noise)
    disbursements["delay_days"] = disbursements["delay_days"].clip(lower=0)

    # Missed disbursement flag
    MISSED_STATUSES = {"Withheld", "withheld", "Pending", "pending"}
    disbursements["is_missed"] = disbursements["status"].isin(MISSED_STATUSES)

    # Pre-group assessments by beneficiary for efficient temporal lookups
    # NOTE: Assessment scores are computed INSIDE the weekly loop to prevent
    # future data leakage — each snapshot only sees assessments taken before its date.
    assessments_by_ben: dict[str, pd.DataFrame] = dict(tuple(assessments.groupby("beneficiary_id")))

    # ── Weekly snapshot generation ────────────────────────────────────────────
    rows = []
    weekly_dates = pd.date_range(
        start=pd.Timestamp(window_start),
        end=pd.Timestamp(today),
        freq="W-MON"
    )

    for _, ben in beneficiaries.iterrows():
        bid     = ben["beneficiary_id"]
        cid     = ben["cohort_id"]
        pillar  = ben["pillar"]
        county  = ben["county"]

        # Beneficiary-level sub-tables
        ben_sessions      = sessions[sessions["beneficiary_id"] == bid]
        ben_visits        = visits[visits["beneficiary_id"] == bid]
        ben_disbursements = disbursements[disbursements["beneficiary_id"] == bid]

        for snap_ts in weekly_dates:
            snap = snap_ts.date()

            # ── sessions_attended_30d / sessions_total_30d / missed_sessions_14d
            d30_start = snap - timedelta(days=30)
            d14_start = snap - timedelta(days=14)

            s30 = ben_sessions[
                (ben_sessions["session_date"] >= d30_start) &
                (ben_sessions["session_date"] <= snap)
            ]
            sessions_total_30d    = len(s30)
            sessions_attended_30d = int(s30["is_present"].sum())
            attendance_rate_30d   = (
                sessions_attended_30d / sessions_total_30d
                if sessions_total_30d > 0 else np.nan
            )

            s14 = ben_sessions[
                (ben_sessions["session_date"] >= d14_start) &
                (ben_sessions["session_date"] <= snap)
            ]
            missed_sessions_14d = int((~s14["is_present"]).sum())

            # ── field_visit_gap_days / no_contact_visits_90d
            d90_start = snap - timedelta(days=90)
            past_visits = ben_visits[ben_visits["visit_date"] <= snap]
            if past_visits.empty:
                field_visit_gap_days = 999
            else:
                last_visit = past_visits["visit_date"].max()
                field_visit_gap_days = (snap - last_visit).days

            v90 = ben_visits[
                (ben_visits["visit_date"] >= d90_start) &
                (ben_visits["visit_date"] <= snap)
            ]
            no_contact_visits_90d = int(v90["is_no_contact"].sum())

            # ── days_since_last_contact
            # Last contact = max of (last session, last field visit)
            last_session_date = (
                ben_sessions[ben_sessions["session_date"] <= snap]["session_date"].max()
                if not ben_sessions[ben_sessions["session_date"] <= snap].empty
                else None
            )
            last_visit_date = (
                past_visits["visit_date"].max() if not past_visits.empty else None
            )
            contacts = [d for d in [last_session_date, last_visit_date] if d is not None]
            if contacts:
                days_since_last_contact = (snap - max(contacts)).days
            else:
                days_since_last_contact = 999

            # ── disbursement_delay_days / missed_disbursements_60d
            d60_start = snap - timedelta(days=60)
            d60_disb = ben_disbursements[
                (ben_disbursements["expected_date"] >= d60_start) &
                (ben_disbursements["expected_date"] <= snap)
            ]
            disbursement_delay_days  = round(d60_disb["delay_days"].mean(), 1) if len(d60_disb) > 0 else 0.0
            missed_disbursements_60d = int(d60_disb["is_missed"].sum())

            # ── assessment scores (TEMPORAL: only considers assessments before snap)
            # This prevents future data leakage — each snapshot only sees data
            # that would have been available at that point in time.
            ben_assessments = assessments_by_ben.get(bid, pd.DataFrame())
            score_latest, score_trend = _compute_assessment_score_as_of(ben_assessments, snap)

            # ── band_now lookup from engagement history
            band_now = None
            if bid in engagement_by_ben:
                snap_ts_dt = pd.Timestamp(snap)
                ben_history = engagement_by_ben[bid]
                # Find exact match or closest week before snap
                matches = ben_history[ben_history["week_start"] <= snap_ts_dt]
                if not matches.empty:
                    closest = matches.loc[matches["week_start"].idxmax()]
                    band_now = closest["band"]
                else:
                    # If no week before, take the earliest
                    band_now = ben_history.loc[ben_history["week_start"].idxmin(), "band"]

            rows.append({
                "beneficiary_id":           bid,
                "cohort_id":                cid,
                "pillar":                   pillar,
                "county":                   county,
                "as_of_date":               snap,
                "days_since_last_contact":  days_since_last_contact,
                "sessions_attended_30d":    sessions_attended_30d,
                "sessions_total_30d":       sessions_total_30d,
                "attendance_rate_30d":      round(attendance_rate_30d, 4)
                                            if not np.isnan(attendance_rate_30d) else np.nan,
                "missed_sessions_14d":      missed_sessions_14d,
                "disbursement_delay_days":  disbursement_delay_days,
                "missed_disbursements_60d": missed_disbursements_60d,
                "assessment_score_latest":  score_latest,
                "assessment_score_trend":   score_trend,
                "field_visit_gap_days":     field_visit_gap_days,
                "no_contact_visits_90d":    no_contact_visits_90d,
                "band_now":                 band_now,
            })

    return pd.DataFrame(rows)


def main():
    parser = argparse.ArgumentParser(description="Inuka Pulse — Feature Engineering")
    parser.add_argument("--days-back", type=int, default=180)
    args = parser.parse_args()

    # Show database configuration status
    try:
        print_db_status()
    except Exception:
        pass

    print(f"Building beneficiary features (window: {args.days_back} days)…")
    df = build_features(days_back=args.days_back)

    out_path = WAREHOUSE_DIR / "fact_beneficiary_features.parquet"
    df.to_parquet(out_path, index=False)

    print(f"Rows:     {len(df):,}")
    print(f"Columns:  {list(df.columns)}")
    print(f"Output:   {out_path}")
    print("Done.")


if __name__ == "__main__":
    main()
