"""
Inuka Pulse — Extended Feature Engineering
============================================
Enriches beneficiary features with program-level context for ML models.

Additional features:
  - program_capacity_utilization: current enrollment / target capacity
  - program_funding_gap: committed - disbursed funding
  - program_funding_rate: disbursed / committed funding
  - program_age_days: days since program start
  - program_field_officer_coverage: allocated FOs / expected FOs
  - pillar_avg_completion_rate: average completion rate for pillar
  - county_demand_index: relative demand score for county

Usage:
    python -m src.extended_features
"""

import argparse
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

RAW_DIR       = Path("data/raw/inuka")
WAREHOUSE_DIR = Path("data/warehouse")


def load_base_features() -> Optional[pd.DataFrame]:
    """Load the base beneficiary features from the warehouse."""
    features_path = WAREHOUSE_DIR / "fact_beneficiary_features.parquet"
    if not features_path.exists():
        print(f"ERROR: {features_path} not found. Run inuka_features.py first.")
        return None
    return pd.read_parquet(features_path)


def load_extended_data() -> dict[str, pd.DataFrame]:
    """Load extended data files (program, donor, funding, etc.)."""
    data = {}
    
    files = {
        "programs": "program.csv",
        "donors": "donor.csv",
        "funding": "donor_funding.csv",
        "allocations": "resource_allocation.csv",
        "indicators": "indicator.csv",
        "measurements": "measurement.csv",
    }
    
    for key, filename in files.items():
        filepath = RAW_DIR / filename
        if filepath.exists():
            data[key] = pd.read_csv(filepath)
            print(f"  Loaded {filename}: {len(data[key]):,} rows")
        else:
            print(f"  SKIP {filename} (not found)")
            data[key] = pd.DataFrame()
    
    return data


def enrich_with_program_context(
    features: pd.DataFrame,
    programs: pd.DataFrame,
    funding: pd.DataFrame,
    allocations: pd.DataFrame,
    cohorts: pd.DataFrame,
) -> pd.DataFrame:
    """
    Add program-level features to beneficiary feature set.
    
    Since beneficiaries are linked to cohorts (not programs directly in our schema),
    we need to map cohort → county + pillar → program(s).
    """
    enriched = features.copy()
    today = date.today()
    
    if programs.empty:
        print("  No program data - skipping program context enrichment")
        return enriched
    
    # Parse dates in programs
    programs["start_date"] = pd.to_datetime(programs["start_date"], errors="coerce")
    
    # ── Program-level aggregations ────────────────────────────────────────────
    
    # Funding by program
    if not funding.empty:
        funding_by_program = funding.groupby("program_id").agg({
            "amount_kes": "sum",
            "disbursed_to_date": "sum",
        }).rename(columns={
            "amount_kes": "total_funding",
            "disbursed_to_date": "total_disbursed",
        })
        
        programs = programs.merge(
            funding_by_program,
            left_on="program_id",
            right_index=True,
            how="left"
        )
        programs["total_funding"] = programs["total_funding"].fillna(0)
        programs["total_disbursed"] = programs["total_disbursed"].fillna(0)
        programs["funding_gap"] = programs["total_funding"] - programs["total_disbursed"]
        programs["funding_rate"] = np.where(
            programs["total_funding"] > 0,
            programs["total_disbursed"] / programs["total_funding"],
            0
        )
    else:
        programs["total_funding"] = 0
        programs["total_disbursed"] = 0
        programs["funding_gap"] = 0
        programs["funding_rate"] = 0
    
    # Field officer allocations by program
    if not allocations.empty:
        fo_allocs = allocations[allocations["resource_type"] == "field_officer"]
        fo_by_program = fo_allocs.groupby("program_id")["allocated_amount"].sum().rename("allocated_fos")
        programs = programs.merge(
            fo_by_program,
            left_on="program_id",
            right_index=True,
            how="left"
        )
        programs["allocated_fos"] = programs["allocated_fos"].fillna(0)
    else:
        programs["allocated_fos"] = 0
    
    # Program age
    programs["program_age_days"] = (pd.Timestamp(today) - programs["start_date"]).dt.days
    programs["program_age_days"] = programs["program_age_days"].fillna(0).clip(lower=0)
    
    # ── Aggregate to county + pillar level ────────────────────────────────────
    # Since cohorts map to county + pillar, we need these aggregates
    
    program_context = programs.groupby(["county", "pillar"]).agg({
        "target_capacity": "sum",
        "funding_gap": "sum",
        "funding_rate": "mean",
        "program_age_days": "mean",
        "allocated_fos": "sum",
    }).reset_index()
    
    program_context = program_context.rename(columns={
        "target_capacity": "program_total_capacity",
        "funding_gap": "program_funding_gap",
        "funding_rate": "program_funding_rate",
        "program_age_days": "program_avg_age_days",
        "allocated_fos": "program_total_fos",
    })
    
    # ── Merge with features ───────────────────────────────────────────────────
    enriched = enriched.merge(
        program_context,
        on=["county", "pillar"],
        how="left"
    )
    
    # Fill missing values with sensible defaults
    enriched["program_total_capacity"] = enriched["program_total_capacity"].fillna(100)
    enriched["program_funding_gap"] = enriched["program_funding_gap"].fillna(0)
    enriched["program_funding_rate"] = enriched["program_funding_rate"].fillna(0.5)
    enriched["program_avg_age_days"] = enriched["program_avg_age_days"].fillna(180)
    enriched["program_total_fos"] = enriched["program_total_fos"].fillna(0)
    
    # ── Compute derived features ──────────────────────────────────────────────
    
    # Estimate current enrollment per county-pillar from cohort data
    if not cohorts.empty:
        cohort_counts = cohorts.groupby(["county", "pillar"]).size().rename("cohort_count")
        enriched = enriched.merge(
            cohort_counts,
            left_on=["county", "pillar"],
            right_index=True,
            how="left"
        )
        enriched["cohort_count"] = enriched["cohort_count"].fillna(1)
        
        # Capacity utilization = cohorts * avg beneficiaries / capacity
        avg_bens_per_cohort = 100  # Approximate
        enriched["capacity_utilization"] = (
            enriched["cohort_count"] * avg_bens_per_cohort / 
            enriched["program_total_capacity"].clip(lower=1)
        ).clip(0, 2)  # Cap at 200%
    else:
        enriched["cohort_count"] = 1
        enriched["capacity_utilization"] = 0.75
    
    # FO coverage ratio
    expected_fo_ratio = 50  # 1 FO per 50 beneficiaries expected
    expected_fos = enriched["cohort_count"] * avg_bens_per_cohort / expected_fo_ratio
    enriched["fo_coverage_ratio"] = (
        enriched["program_total_fos"] / expected_fos.clip(lower=1)
    ).clip(0, 2)
    
    return enriched


def add_pillar_benchmarks(features: pd.DataFrame) -> pd.DataFrame:
    """Add pillar-level benchmark features."""
    enriched = features.copy()
    
    # Calculate pillar-level statistics from the data
    pillar_stats = features.groupby("pillar").agg({
        "attendance_rate_30d": "mean",
        "missed_sessions_14d": "mean",
        "disbursement_delay_days": "mean",
        "assessment_score_latest": "mean",
    }).rename(columns={
        "attendance_rate_30d": "pillar_avg_attendance",
        "missed_sessions_14d": "pillar_avg_missed_sessions",
        "disbursement_delay_days": "pillar_avg_delay_days",
        "assessment_score_latest": "pillar_avg_score",
    })
    
    enriched = enriched.merge(
        pillar_stats,
        left_on="pillar",
        right_index=True,
        how="left"
    )
    
    # Calculate relative performance vs pillar benchmark
    enriched["attendance_vs_pillar"] = (
        enriched["attendance_rate_30d"] - enriched["pillar_avg_attendance"]
    )
    enriched["score_vs_pillar"] = (
        enriched["assessment_score_latest"] - enriched["pillar_avg_score"]
    )
    
    return enriched


def add_county_demand_index(features: pd.DataFrame, measurements: pd.DataFrame) -> pd.DataFrame:
    """
    Add county-level demand index based on enrollment trends.
    """
    enriched = features.copy()
    
    if measurements.empty:
        enriched["county_demand_index"] = 1.0
        return enriched
    
    # Filter for enrollment-related indicators
    enrollment_measurements = measurements[
        measurements["indicator_id"].str.contains("IND-", na=False) &
        measurements["county"].notna()
    ]
    
    if enrollment_measurements.empty:
        enriched["county_demand_index"] = 1.0
        return enriched
    
    # Calculate average measurement value by county (proxy for demand)
    county_demand = enrollment_measurements.groupby("county")["value"].mean()
    
    # Normalize to 0.5-1.5 range
    if county_demand.max() > county_demand.min():
        county_demand_normalized = (
            0.5 + (county_demand - county_demand.min()) / 
            (county_demand.max() - county_demand.min())
        )
    else:
        county_demand_normalized = pd.Series(1.0, index=county_demand.index)
    
    county_demand_normalized.name = "county_demand_index"
    
    enriched = enriched.merge(
        county_demand_normalized,
        left_on="county",
        right_index=True,
        how="left"
    )
    enriched["county_demand_index"] = enriched["county_demand_index"].fillna(1.0)
    
    return enriched


def build_extended_features() -> pd.DataFrame:
    """
    Build the complete extended feature set.
    
    Returns:
        DataFrame with base features + program context + benchmarks
    """
    print("Loading base features…")
    features = load_base_features()
    if features is None:
        return pd.DataFrame()
    
    print(f"Base features: {len(features):,} rows")
    
    print("\nLoading extended data…")
    ext_data = load_extended_data()
    
    # Load cohorts for mapping
    cohorts_path = RAW_DIR / "dim_cohort.csv"
    if cohorts_path.exists():
        cohorts = pd.read_csv(cohorts_path)
        print(f"  Loaded dim_cohort.csv: {len(cohorts):,} rows")
    else:
        cohorts = pd.DataFrame()
        print("  SKIP dim_cohort.csv (not found)")
    
    print("\nEnriching with program context…")
    features = enrich_with_program_context(
        features,
        ext_data.get("programs", pd.DataFrame()),
        ext_data.get("funding", pd.DataFrame()),
        ext_data.get("allocations", pd.DataFrame()),
        cohorts,
    )
    
    print("Adding pillar benchmarks…")
    features = add_pillar_benchmarks(features)
    
    print("Adding county demand index…")
    features = add_county_demand_index(
        features,
        ext_data.get("measurements", pd.DataFrame())
    )
    
    # Fill any remaining NaN values
    numeric_cols = features.select_dtypes(include=[np.number]).columns
    features[numeric_cols] = features[numeric_cols].fillna(0)
    
    return features


def main():
    parser = argparse.ArgumentParser(description="Inuka Pulse — Extended Feature Engineering")
    parser.add_argument("--output", default="fact_extended_features.parquet",
                       help="Output filename in warehouse directory")
    args = parser.parse_args()
    
    print("Inuka Pulse — Extended Feature Engineering")
    print("=" * 50)
    
    features = build_extended_features()
    
    if features.empty:
        print("\nERROR: No features generated")
        return
    
    out_path = WAREHOUSE_DIR / args.output
    features.to_parquet(out_path, index=False)
    
    print(f"\nOutput: {out_path}")
    print(f"Rows:   {len(features):,}")
    print(f"Cols:   {len(features.columns)}")
    
    # Show new columns
    base_cols = [
        "beneficiary_id", "cohort_id", "pillar", "county", "as_of_date",
        "days_since_last_contact", "sessions_attended_30d", "sessions_total_30d",
        "attendance_rate_30d", "missed_sessions_14d", "disbursement_delay_days",
        "missed_disbursements_60d", "assessment_score_latest", "assessment_score_trend",
        "field_visit_gap_days", "no_contact_visits_90d",
    ]
    new_cols = [c for c in features.columns if c not in base_cols]
    print(f"\nNew features ({len(new_cols)}):")
    for col in new_cols:
        print(f"  - {col}")
    
    print("\nDone.")


if __name__ == "__main__":
    main()
