"""
Inuka Pulse — Extended Pandera Validation Schemas
==================================================
Defines validation schemas for the extended M&E and Donor data entities.

Schemas:
    - ProgramSchema      : program.csv validation
    - DonorSchema        : donor.csv validation
    - DonorFundingSchema : donor_funding.csv validation
    - ResourceAllocationSchema : resource_allocation.csv validation
    - IndicatorSchema    : indicator.csv validation
    - MeasurementSchema  : measurement.csv validation

Usage:
    from src.extended_schemas import validate_extended_data
    
    errors = validate_extended_data("data/raw/inuka")
    if errors:
        print("Validation failed:", errors)
"""

from pathlib import Path
from typing import Optional

import pandas as pd
import pandera as pa
from pandera import Column, Check, DataFrameSchema
from pandera.errors import SchemaError, SchemaErrors


# ══════════════════════════════════════════════════════════════════════════════
# Schema Definitions
# ══════════════════════════════════════════════════════════════════════════════

VALID_PILLARS = ["Scholarship", "Plus", "Vocational", "Tech"]
VALID_PROGRAM_STATUSES = ["active", "completed", "planned"]
VALID_FUNDING_STATUSES = ["active", "completed", "suspended"]
VALID_RESOURCE_TYPES = ["field_officer", "training_capacity", "budget"]
VALID_ALLOCATION_SOURCES = ["manual", "ml_recommended"]
VALID_ALLOCATION_STATUSES = ["pending", "approved", "rejected"]
VALID_INDICATOR_CATEGORIES = ["output", "outcome", "impact"]


ProgramSchema = DataFrameSchema(
    columns={
        "program_id": Column(str, Check.str_matches(r"^PROG-[a-f0-9]{8}$"), unique=True, nullable=False),
        "pillar": Column(str, Check.isin(VALID_PILLARS), nullable=False),
        "name": Column(str, Check.str_length(min_value=5, max_value=255), nullable=False),
        "county": Column(str, Check.str_length(min_value=2, max_value=100), nullable=False),
        "start_date": Column(str, Check.str_matches(r"^\d{4}-\d{2}-\d{2}$"), nullable=False),
        "end_date": Column(str, Check.str_matches(r"^\d{4}-\d{2}-\d{2}$"), nullable=True),
        "target_capacity": Column(int, Check.ge(1), nullable=False),
        "status": Column(str, Check.isin(VALID_PROGRAM_STATUSES), nullable=False),
        "description": Column(str, nullable=True),
    },
    strict=False,  # Allow extra columns
    coerce=True,
)


DonorSchema = DataFrameSchema(
    columns={
        "donor_id": Column(str, Check.str_matches(r"^DONOR-[a-f0-9]{8}$"), unique=True, nullable=False),
        "name": Column(str, Check.str_length(min_value=3, max_value=255), unique=True, nullable=False),
        "contact_email": Column(str, Check.str_contains("@"), nullable=True),
        "donor_type": Column(str, Check.str_length(min_value=2, max_value=50), nullable=True),
        "is_active": Column(bool, nullable=False),
    },
    strict=False,
    coerce=True,
)


DonorFundingSchema = DataFrameSchema(
    columns={
        "id": Column(str, Check.str_matches(r"^FUND-[a-f0-9]{8}$"), unique=True, nullable=False),
        "donor_id": Column(str, Check.str_matches(r"^DONOR-[a-f0-9]{8}$"), nullable=False),
        "program_id": Column(str, Check.str_matches(r"^PROG-[a-f0-9]{8}$"), nullable=False),
        "amount_kes": Column(float, Check.ge(0), nullable=False),
        "currency": Column(str, Check.eq("KES"), nullable=True),
        "fiscal_year": Column(int, Check.in_range(2020, 2040), nullable=False),
        "disbursed_to_date": Column(float, Check.ge(0), nullable=False),
        "funding_status": Column(str, Check.isin(VALID_FUNDING_STATUSES), nullable=False),
    },
    checks=[
        # disbursed_to_date should not exceed amount_kes (soft check - log warning)
        Check(lambda df: (df["disbursed_to_date"] <= df["amount_kes"] * 1.05).all(), 
              name="disbursed_not_exceeding_amount",
              error="Disbursed amount exceeds committed amount by more than 5%"),
    ],
    strict=False,
    coerce=True,
)


ResourceAllocationSchema = DataFrameSchema(
    columns={
        "id": Column(str, Check.str_matches(r"^ALLOC-[a-f0-9]{8}$"), unique=True, nullable=False),
        "program_id": Column(str, Check.str_matches(r"^PROG-[a-f0-9]{8}$"), nullable=False),
        "region": Column(str, Check.str_length(min_value=2, max_value=100), nullable=False),
        "resource_type": Column(str, Check.isin(VALID_RESOURCE_TYPES), nullable=False),
        "allocated_amount": Column(float, Check.ge(0), nullable=False),
        "unit": Column(str, Check.str_length(min_value=1, max_value=50), nullable=True),
        "period_start": Column(str, Check.str_matches(r"^\d{4}-\d{2}-\d{2}$"), nullable=False),
        "period_end": Column(str, Check.str_matches(r"^\d{4}-\d{2}-\d{2}$"), nullable=False),
        "source": Column(str, Check.isin(VALID_ALLOCATION_SOURCES), nullable=False),
        "status": Column(str, Check.isin(VALID_ALLOCATION_STATUSES), nullable=False),
        "priority_score": Column(float, Check.in_range(0, 100), nullable=True),
        "rationale": Column(str, nullable=True),
    },
    checks=[
        Check(lambda df: (pd.to_datetime(df["period_end"]) >= pd.to_datetime(df["period_start"])).all(),
              name="valid_period_range",
              error="period_end must be >= period_start"),
    ],
    strict=False,
    coerce=True,
)


IndicatorSchema = DataFrameSchema(
    columns={
        "indicator_id": Column(str, Check.str_matches(r"^IND-[a-f0-9]{8}$"), unique=True, nullable=False),
        "name": Column(str, Check.str_length(min_value=3, max_value=255), nullable=False),
        "category": Column(str, Check.isin(VALID_INDICATOR_CATEGORIES), nullable=False),
        "unit": Column(str, Check.str_length(min_value=1, max_value=50), nullable=False),
        "definition": Column(str, nullable=True),
        "version": Column(int, Check.ge(1), nullable=True),
        "is_active": Column(bool, nullable=True),
    },
    strict=False,
    coerce=True,
)


MeasurementSchema = DataFrameSchema(
    columns={
        "id": Column(str, Check.str_matches(r"^MEAS-[a-f0-9]{8}$"), unique=True, nullable=False),
        "indicator_id": Column(str, Check.str_matches(r"^IND-[a-f0-9]{8}$"), nullable=False),
        "program_id": Column(str, Check.str_matches(r"^PROG-[a-f0-9]{8}$"), nullable=True),
        "cohort_id": Column(str, nullable=True),
        "county": Column(str, Check.str_length(min_value=2, max_value=100), nullable=True),
        "pillar": Column(str, Check.isin(VALID_PILLARS + [None]), nullable=True),
        "period_start": Column(str, Check.str_matches(r"^\d{4}-\d{2}-\d{2}$"), nullable=False),
        "period_end": Column(str, Check.str_matches(r"^\d{4}-\d{2}-\d{2}$"), nullable=False),
        "value": Column(float, nullable=False),
    },
    strict=False,
    coerce=True,
)


# ══════════════════════════════════════════════════════════════════════════════
# Validation Functions
# ══════════════════════════════════════════════════════════════════════════════

def validate_extended_data(data_dir: str | Path) -> dict[str, list[str]]:
    """
    Validate all extended data files in the given directory.
    
    Args:
        data_dir: Path to directory containing CSV files
        
    Returns:
        Dictionary mapping filename to list of validation errors.
        Empty dict means all validations passed.
    """
    data_dir = Path(data_dir)
    errors = {}
    
    schemas = {
        "program.csv": ProgramSchema,
        "donor.csv": DonorSchema,
        "donor_funding.csv": DonorFundingSchema,
        "resource_allocation.csv": ResourceAllocationSchema,
        "indicator.csv": IndicatorSchema,
        "measurement.csv": MeasurementSchema,
    }
    
    for filename, schema in schemas.items():
        filepath = data_dir / filename
        if not filepath.exists():
            errors[filename] = [f"File not found: {filepath}"]
            continue
        
        try:
            df = pd.read_csv(filepath)
            schema.validate(df, lazy=True)
        except SchemaErrors as e:
            errors[filename] = [str(err) for err in e.schema_errors]
        except Exception as e:
            errors[filename] = [str(e)]
    
    return errors


def validate_referential_integrity(data_dir: str | Path) -> dict[str, list[str]]:
    """
    Validate foreign key relationships between extended data files.
    
    Checks:
        - donor_funding.donor_id references donor.donor_id
        - donor_funding.program_id references program.program_id
        - resource_allocation.program_id references program.program_id
        - measurement.indicator_id references indicator.indicator_id
        - measurement.program_id references program.program_id (where not null)
    
    Returns:
        Dictionary mapping check name to list of orphaned IDs.
    """
    data_dir = Path(data_dir)
    errors = {}
    
    # Load all tables
    try:
        programs = pd.read_csv(data_dir / "program.csv")
        donors = pd.read_csv(data_dir / "donor.csv")
        funding = pd.read_csv(data_dir / "donor_funding.csv")
        allocations = pd.read_csv(data_dir / "resource_allocation.csv")
        indicators = pd.read_csv(data_dir / "indicator.csv")
        measurements = pd.read_csv(data_dir / "measurement.csv")
    except FileNotFoundError as e:
        return {"file_load": [str(e)]}
    
    # FK: donor_funding.donor_id → donor.donor_id
    valid_donors = set(donors["donor_id"])
    orphan_donor_refs = funding[~funding["donor_id"].isin(valid_donors)]["donor_id"].unique()
    if len(orphan_donor_refs) > 0:
        errors["funding_donor_fk"] = list(orphan_donor_refs)
    
    # FK: donor_funding.program_id → program.program_id
    valid_programs = set(programs["program_id"])
    orphan_program_refs = funding[~funding["program_id"].isin(valid_programs)]["program_id"].unique()
    if len(orphan_program_refs) > 0:
        errors["funding_program_fk"] = list(orphan_program_refs)
    
    # FK: resource_allocation.program_id → program.program_id
    orphan_alloc_refs = allocations[~allocations["program_id"].isin(valid_programs)]["program_id"].unique()
    if len(orphan_alloc_refs) > 0:
        errors["allocation_program_fk"] = list(orphan_alloc_refs)
    
    # FK: measurement.indicator_id → indicator.indicator_id
    valid_indicators = set(indicators["indicator_id"])
    orphan_ind_refs = measurements[~measurements["indicator_id"].isin(valid_indicators)]["indicator_id"].unique()
    if len(orphan_ind_refs) > 0:
        errors["measurement_indicator_fk"] = list(orphan_ind_refs)
    
    # FK: measurement.program_id → program.program_id (where not null)
    meas_with_program = measurements[measurements["program_id"].notna()]
    orphan_meas_prog = meas_with_program[~meas_with_program["program_id"].isin(valid_programs)]["program_id"].unique()
    if len(orphan_meas_prog) > 0:
        errors["measurement_program_fk"] = list(orphan_meas_prog)
    
    return errors


# ══════════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate extended Inuka data files")
    parser.add_argument("--data-dir", default="data/raw/inuka", help="Directory containing CSV files")
    args = parser.parse_args()
    
    print("Inuka Pulse — Extended Data Validation")
    print("=" * 50)
    
    print("\n1. Schema validation…")
    schema_errors = validate_extended_data(args.data_dir)
    if schema_errors:
        for filename, errs in schema_errors.items():
            print(f"  ❌ {filename}:")
            for err in errs[:3]:  # Limit to first 3 errors
                print(f"      {err[:100]}…" if len(str(err)) > 100 else f"      {err}")
    else:
        print("  ✅ All schemas valid")
    
    print("\n2. Referential integrity…")
    fk_errors = validate_referential_integrity(args.data_dir)
    if fk_errors:
        for check, orphans in fk_errors.items():
            print(f"  ❌ {check}: {len(orphans)} orphaned references")
            if len(orphans) <= 5:
                print(f"      {orphans}")
    else:
        print("  ✅ All foreign keys valid")
    
    print("\n" + "=" * 50)
    if schema_errors or fk_errors:
        print("❌ Validation FAILED")
        exit(1)
    else:
        print("✅ Validation PASSED")
        exit(0)
