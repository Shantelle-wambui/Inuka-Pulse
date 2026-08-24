"""
Inuka Pulse — Extended ETL Pipeline
====================================
Extends the core ETL pipeline with additional data sources and validation rules
for the M&E and Donor Portal features.

This module:
1. Extracts program, donor, funding, allocation, indicator, and measurement data
2. Validates using pandera schemas + FK integrity checks
3. Transforms and enriches data
4. Loads to warehouse (JSON exports for backend consumption)

Usage:
    python -m src.extended_etl
    python -m src.extended_etl --skip-validation  # Skip schema validation
"""

import argparse
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from src.extended_schemas import (
    ProgramSchema,
    DonorSchema,
    DonorFundingSchema,
    ResourceAllocationSchema,
    IndicatorSchema,
    MeasurementSchema,
    validate_referential_integrity,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
RAW_DIR       = Path("data/raw/inuka")
WAREHOUSE_DIR = Path("data/warehouse")
QUARANTINE_DIR = Path("data/quarantine")

WAREHOUSE_DIR.mkdir(parents=True, exist_ok=True)
QUARANTINE_DIR.mkdir(parents=True, exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
# EXTRACT
# ══════════════════════════════════════════════════════════════════════════════

def extract_all() -> dict[str, pd.DataFrame]:
    """Extract all extended data sources."""
    sources = {
        "programs": "program.csv",
        "donors": "donor.csv",
        "funding": "donor_funding.csv",
        "allocations": "resource_allocation.csv",
        "indicators": "indicator.csv",
        "measurements": "measurement.csv",
    }
    
    data = {}
    for key, filename in sources.items():
        filepath = RAW_DIR / filename
        if filepath.exists():
            df = pd.read_csv(filepath)
            log.info(f"EXTRACT | {filename}: {len(df):,} rows")
            data[key] = df
        else:
            log.warning(f"EXTRACT | {filename}: NOT FOUND")
            data[key] = pd.DataFrame()
    
    return data


# ══════════════════════════════════════════════════════════════════════════════
# VALIDATE
# ══════════════════════════════════════════════════════════════════════════════

def validate_schemas(data: dict[str, pd.DataFrame], skip: bool = False) -> dict[str, pd.DataFrame]:
    """
    Validate each DataFrame against its pandera schema.
    Quarantine invalid rows and return validated data.
    """
    if skip:
        log.info("VALIDATE | Schema validation SKIPPED")
        return data
    
    schemas = {
        "programs": ProgramSchema,
        "donors": DonorSchema,
        "funding": DonorFundingSchema,
        "allocations": ResourceAllocationSchema,
        "indicators": IndicatorSchema,
        "measurements": MeasurementSchema,
    }
    
    validated = {}
    
    for key, df in data.items():
        if df.empty:
            validated[key] = df
            continue
        
        schema = schemas.get(key)
        if not schema:
            validated[key] = df
            continue
        
        try:
            validated_df = schema.validate(df, lazy=True)
            log.info(f"VALIDATE | {key}: PASSED ({len(validated_df):,} rows)")
            validated[key] = validated_df
        except Exception as e:
            # Try to recover valid rows
            log.warning(f"VALIDATE | {key}: PARTIAL FAILURE - {e}")
            try:
                # Attempt row-by-row validation for partial recovery
                valid_mask = df.apply(lambda row: _validate_row(row, schema), axis=1)
                valid_rows = df[valid_mask]
                invalid_rows = df[~valid_mask]
                
                if len(invalid_rows) > 0:
                    quarantine_path = QUARANTINE_DIR / f"{key}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                    invalid_rows.to_csv(quarantine_path, index=False)
                    log.warning(f"VALIDATE | {key}: {len(invalid_rows)} rows quarantined → {quarantine_path}")
                
                validated[key] = valid_rows
                log.info(f"VALIDATE | {key}: {len(valid_rows):,} valid rows recovered")
            except Exception as e2:
                log.error(f"VALIDATE | {key}: FAILED - {e2}")
                validated[key] = pd.DataFrame()
    
    return validated


def _validate_row(row: pd.Series, schema) -> bool:
    """Check if a single row passes schema validation."""
    try:
        schema.validate(pd.DataFrame([row]), lazy=True)
        return True
    except Exception:
        return False


def validate_fk_integrity(data: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """
    Validate foreign key relationships.
    Quarantine rows with orphaned references.
    """
    log.info("VALIDATE | Checking referential integrity…")
    
    programs = data.get("programs", pd.DataFrame())
    donors = data.get("donors", pd.DataFrame())
    funding = data.get("funding", pd.DataFrame())
    allocations = data.get("allocations", pd.DataFrame())
    indicators = data.get("indicators", pd.DataFrame())
    measurements = data.get("measurements", pd.DataFrame())
    
    if programs.empty:
        log.warning("VALIDATE | No programs - skipping FK checks")
        return data
    
    valid_program_ids = set(programs["program_id"]) if not programs.empty else set()
    valid_donor_ids = set(donors["donor_id"]) if not donors.empty else set()
    valid_indicator_ids = set(indicators["indicator_id"]) if not indicators.empty else set()
    
    # Filter funding by valid FKs
    if not funding.empty:
        original_count = len(funding)
        funding = funding[
            funding["donor_id"].isin(valid_donor_ids) &
            funding["program_id"].isin(valid_program_ids)
        ]
        removed = original_count - len(funding)
        if removed > 0:
            log.warning(f"VALIDATE | funding: {removed} rows removed (invalid FKs)")
        data["funding"] = funding
    
    # Filter allocations by valid program_id
    if not allocations.empty:
        original_count = len(allocations)
        allocations = allocations[allocations["program_id"].isin(valid_program_ids)]
        removed = original_count - len(allocations)
        if removed > 0:
            log.warning(f"VALIDATE | allocations: {removed} rows removed (invalid program_id)")
        data["allocations"] = allocations
    
    # Filter measurements by valid indicator_id
    if not measurements.empty:
        original_count = len(measurements)
        measurements = measurements[measurements["indicator_id"].isin(valid_indicator_ids)]
        removed = original_count - len(measurements)
        if removed > 0:
            log.warning(f"VALIDATE | measurements: {removed} rows removed (invalid indicator_id)")
        data["measurements"] = measurements
    
    log.info("VALIDATE | FK integrity check complete")
    return data


# ══════════════════════════════════════════════════════════════════════════════
# TRANSFORM
# ══════════════════════════════════════════════════════════════════════════════

def transform_programs(programs: pd.DataFrame) -> pd.DataFrame:
    """Transform program data for warehouse."""
    if programs.empty:
        return programs
    
    df = programs.copy()
    
    # Parse dates
    df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
    df["end_date"] = pd.to_datetime(df["end_date"], errors="coerce")
    
    # Compute derived fields
    today = pd.Timestamp.now()
    df["is_active"] = df["status"] == "active"
    df["program_age_days"] = (today - df["start_date"]).dt.days.clip(lower=0)
    
    log.info(f"TRANSFORM | programs: {len(df)} rows, {df['is_active'].sum()} active")
    return df


def transform_funding(funding: pd.DataFrame, programs: pd.DataFrame) -> pd.DataFrame:
    """Transform funding data with program enrichment."""
    if funding.empty:
        return funding
    
    df = funding.copy()
    
    # Calculate utilization
    df["utilization_rate"] = (
        df["disbursed_to_date"] / df["amount_kes"].clip(lower=1)
    ).clip(0, 1)
    
    df["funding_gap"] = df["amount_kes"] - df["disbursed_to_date"]
    
    # Add program context if available
    if not programs.empty:
        program_cols = programs[["program_id", "pillar", "county", "name"]].copy()
        program_cols = program_cols.rename(columns={"name": "program_name"})
        df = df.merge(program_cols, on="program_id", how="left")
    
    log.info(f"TRANSFORM | funding: {len(df)} rows, total {df['amount_kes'].sum()/1e6:.1f}M KES")
    return df


def transform_allocations(allocations: pd.DataFrame, programs: pd.DataFrame) -> pd.DataFrame:
    """Transform allocation data."""
    if allocations.empty:
        return allocations
    
    df = allocations.copy()
    
    # Parse dates
    df["period_start"] = pd.to_datetime(df["period_start"], errors="coerce")
    df["period_end"] = pd.to_datetime(df["period_end"], errors="coerce")
    
    # Duration in days
    df["period_days"] = (df["period_end"] - df["period_start"]).dt.days
    
    # Is current
    today = pd.Timestamp.now()
    df["is_current"] = (df["period_start"] <= today) & (df["period_end"] >= today)
    
    # Add program context
    if not programs.empty:
        program_cols = programs[["program_id", "pillar", "county", "name"]].copy()
        program_cols = program_cols.rename(columns={"name": "program_name"})
        df = df.merge(program_cols, on="program_id", how="left")
    
    log.info(f"TRANSFORM | allocations: {len(df)} rows, {df['is_current'].sum()} current")
    return df


def transform_measurements(
    measurements: pd.DataFrame,
    indicators: pd.DataFrame
) -> pd.DataFrame:
    """Transform measurement data with indicator context."""
    if measurements.empty:
        return measurements
    
    df = measurements.copy()
    
    # Parse dates
    df["period_start"] = pd.to_datetime(df["period_start"], errors="coerce")
    df["period_end"] = pd.to_datetime(df["period_end"], errors="coerce")
    
    # Add indicator context
    if not indicators.empty:
        indicator_cols = indicators[["indicator_id", "name", "category", "unit"]].copy()
        indicator_cols = indicator_cols.rename(columns={"name": "indicator_name"})
        df = df.merge(indicator_cols, on="indicator_id", how="left")
    
    log.info(f"TRANSFORM | measurements: {len(df)} rows")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# LOAD
# ══════════════════════════════════════════════════════════════════════════════

def export_to_json(data: dict[str, pd.DataFrame]):
    """Export transformed data to JSON for backend consumption."""
    
    # Programs export
    if "programs" in data and not data["programs"].empty:
        programs_df = data["programs"].copy()
        # Convert dates to strings
        for col in ["start_date", "end_date"]:
            if col in programs_df.columns:
                programs_df[col] = programs_df[col].dt.strftime("%Y-%m-%d").fillna("")
        
        programs_export = {
            "generated_at": datetime.now().isoformat(),
            "count": len(programs_df),
            "programs": programs_df.to_dict(orient="records"),
        }
        export_path = WAREHOUSE_DIR / "programs_export.json"
        with open(export_path, "w") as f:
            json.dump(programs_export, f, indent=2, default=str)
        log.info(f"LOAD | programs_export.json: {len(programs_df)} programs")
    
    # Donors export
    if "donors" in data and not data["donors"].empty:
        donors_df = data["donors"].copy()
        donors_export = {
            "generated_at": datetime.now().isoformat(),
            "count": len(donors_df),
            "donors": donors_df.to_dict(orient="records"),
        }
        export_path = WAREHOUSE_DIR / "donors_export.json"
        with open(export_path, "w") as f:
            json.dump(donors_export, f, indent=2, default=str)
        log.info(f"LOAD | donors_export.json: {len(donors_df)} donors")
    
    # Funding summary export
    if "funding" in data and not data["funding"].empty:
        funding_df = data["funding"].copy()
        
        # Aggregate by pillar
        pillar_summary = funding_df.groupby("pillar").agg({
            "amount_kes": "sum",
            "disbursed_to_date": "sum",
            "program_id": "nunique",
        }).rename(columns={"program_id": "program_count"}).reset_index()
        
        # Aggregate by fiscal year
        fy_summary = funding_df.groupby("fiscal_year").agg({
            "amount_kes": "sum",
            "disbursed_to_date": "sum",
        }).reset_index()
        
        funding_export = {
            "generated_at": datetime.now().isoformat(),
            "total_committed": float(funding_df["amount_kes"].sum()),
            "total_disbursed": float(funding_df["disbursed_to_date"].sum()),
            "by_pillar": pillar_summary.to_dict(orient="records"),
            "by_fiscal_year": fy_summary.to_dict(orient="records"),
            "funding_records": funding_df.to_dict(orient="records"),
        }
        export_path = WAREHOUSE_DIR / "funding_export.json"
        with open(export_path, "w") as f:
            json.dump(funding_export, f, indent=2, default=str)
        log.info(f"LOAD | funding_export.json: {len(funding_df)} records")
    
    # Allocations export (pending recommendations)
    if "allocations" in data and not data["allocations"].empty:
        alloc_df = data["allocations"].copy()
        
        # Filter to pending ML recommendations
        pending = alloc_df[
            (alloc_df["source"] == "ml_recommended") &
            (alloc_df["status"] == "pending")
        ]
        
        for col in ["period_start", "period_end"]:
            if col in pending.columns:
                pending[col] = pending[col].dt.strftime("%Y-%m-%d").fillna("")
        
        alloc_export = {
            "generated_at": datetime.now().isoformat(),
            "pending_count": len(pending),
            "total_count": len(alloc_df),
            "pending_recommendations": pending.to_dict(orient="records"),
        }
        export_path = WAREHOUSE_DIR / "allocations_export.json"
        with open(export_path, "w") as f:
            json.dump(alloc_export, f, indent=2, default=str)
        log.info(f"LOAD | allocations_export.json: {len(pending)} pending")
    
    # Indicators export
    if "indicators" in data and not data["indicators"].empty:
        indicators_df = data["indicators"].copy()
        indicators_export = {
            "generated_at": datetime.now().isoformat(),
            "count": len(indicators_df),
            "indicators": indicators_df.to_dict(orient="records"),
        }
        export_path = WAREHOUSE_DIR / "indicators_export.json"
        with open(export_path, "w") as f:
            json.dump(indicators_export, f, indent=2, default=str)
        log.info(f"LOAD | indicators_export.json: {len(indicators_df)} indicators")
    
    # Dashboard metrics export
    if "measurements" in data and not data["measurements"].empty:
        meas_df = data["measurements"].copy()
        
        # Calculate dashboard metrics by scope
        metrics = compute_dashboard_metrics(meas_df)
        
        export_path = WAREHOUSE_DIR / "dashboard_metrics_export.json"
        with open(export_path, "w") as f:
            json.dump(metrics, f, indent=2, default=str)
        log.info(f"LOAD | dashboard_metrics_export.json: {len(metrics['metrics'])} metrics")


def compute_dashboard_metrics(measurements: pd.DataFrame) -> dict:
    """
    Compute dashboard metrics from measurements.
    Returns metrics suitable for the dashboard_metrics table.
    """
    metrics = []
    
    if measurements.empty:
        return {"generated_at": datetime.now().isoformat(), "metrics": []}
    
    # Recent measurements (last 90 days)
    recent_date = pd.Timestamp.now() - pd.Timedelta(days=90)
    recent = measurements[measurements["period_start"] >= recent_date]
    
    if recent.empty:
        recent = measurements  # Fallback to all
    
    # Org-level metrics
    for indicator_name in recent["indicator_name"].unique():
        if pd.isna(indicator_name):
            continue
        indicator_data = recent[recent["indicator_name"] == indicator_name]
        avg_value = indicator_data["value"].mean()
        
        metrics.append({
            "metric_key": indicator_name,
            "scope_type": "org",
            "scope_id": "inuka",
            "period": "current",
            "value": round(avg_value, 4),
        })
    
    # Pillar-level metrics
    for pillar in recent["pillar"].dropna().unique():
        pillar_data = recent[recent["pillar"] == pillar]
        for indicator_name in pillar_data["indicator_name"].unique():
            if pd.isna(indicator_name):
                continue
            ind_data = pillar_data[pillar_data["indicator_name"] == indicator_name]
            avg_value = ind_data["value"].mean()
            
            metrics.append({
                "metric_key": indicator_name,
                "scope_type": "pillar",
                "scope_id": pillar,
                "period": "current",
                "value": round(avg_value, 4),
            })
    
    # County-level metrics
    for county in recent["county"].dropna().unique():
        county_data = recent[recent["county"] == county]
        for indicator_name in county_data["indicator_name"].unique():
            if pd.isna(indicator_name):
                continue
            ind_data = county_data[county_data["indicator_name"] == indicator_name]
            avg_value = ind_data["value"].mean()
            
            metrics.append({
                "metric_key": indicator_name,
                "scope_type": "county",
                "scope_id": county,
                "period": "current",
                "value": round(avg_value, 4),
            })
    
    return {
        "generated_at": datetime.now().isoformat(),
        "metrics": metrics,
    }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def run_extended_etl(skip_validation: bool = False):
    """Run the complete extended ETL pipeline."""
    log.info("=" * 60)
    log.info("Inuka Pulse — Extended ETL Pipeline")
    log.info("=" * 60)
    
    # EXTRACT
    log.info("\n[EXTRACT]")
    data = extract_all()
    
    # VALIDATE
    log.info("\n[VALIDATE]")
    data = validate_schemas(data, skip=skip_validation)
    data = validate_fk_integrity(data)
    
    # TRANSFORM
    log.info("\n[TRANSFORM]")
    data["programs"] = transform_programs(data.get("programs", pd.DataFrame()))
    data["funding"] = transform_funding(
        data.get("funding", pd.DataFrame()),
        data.get("programs", pd.DataFrame())
    )
    data["allocations"] = transform_allocations(
        data.get("allocations", pd.DataFrame()),
        data.get("programs", pd.DataFrame())
    )
    data["measurements"] = transform_measurements(
        data.get("measurements", pd.DataFrame()),
        data.get("indicators", pd.DataFrame())
    )
    
    # LOAD
    log.info("\n[LOAD]")
    export_to_json(data)
    
    log.info("\n" + "=" * 60)
    log.info("Extended ETL pipeline complete")
    log.info("=" * 60)
    
    return data


def main():
    parser = argparse.ArgumentParser(description="Inuka Pulse — Extended ETL Pipeline")
    parser.add_argument("--skip-validation", action="store_true",
                       help="Skip schema validation")
    args = parser.parse_args()
    
    run_extended_etl(skip_validation=args.skip_validation)


if __name__ == "__main__":
    main()
