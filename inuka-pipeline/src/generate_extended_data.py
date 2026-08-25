"""
Inuka Pulse — Extended Synthetic Data Generator
================================================
Generates additional data files for the extended M&E and Donor Portal features.
Must be run AFTER generate_inuka_data.py (depends on dim_cohort.csv).

New Outputs (in data/raw/inuka/):
    program.csv             (~200 programs across 4 pillars, 12 counties)
    donor.csv               (~25 donors)
    donor_funding.csv       (~500 funding records linking donors to programs)
    resource_allocation.csv (~1000 allocation records)
    indicator.csv           (~30 M&E indicator definitions)
    measurement.csv         (~50000 indicator measurements)

Run:
    python3 -m src.generate_extended_data          # outputs to data/raw/inuka/
    python3 src/generate_extended_data.py          # same

Requires:
    - dim_cohort.csv to exist (run generate_inuka_data.py first)
"""

import csv
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from faker import Faker

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
fake = Faker("en_GB")
Faker.seed(SEED)

# ── Paths ────────────────────────────────────────────────────────────────────
OUT_DIR = Path("data/raw/inuka")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Anchor date ──────────────────────────────────────────────────────────────
TODAY = datetime(2026, 8, 23)
FISCAL_YEAR_START = datetime(2026, 1, 1)

# ── Domain constants ─────────────────────────────────────────────────────────
PILLARS = ["Scholarship", "Plus", "Vocational", "Tech"]

# Extended county list for more programs
COUNTIES = [
    "Nairobi", "Mombasa", "Nakuru", "Kisumu", "Eldoret",
    "Kiambu", "Machakos", "Kajiado", "Meru", "Nyeri",
    "Kilifi", "Kakamega",
]

DONOR_TYPES = ["Foundation", "Corporate", "Government", "Bilateral", "NGO"]

RESOURCE_TYPES = ["field_officer", "training_capacity", "budget"]

INDICATOR_DEFINITIONS = [
    # Output indicators
    {"name": "total_enrolled", "category": "output", "unit": "count", "definition": "Total beneficiaries ever enrolled in the program"},
    {"name": "active_enrolled", "category": "output", "unit": "count", "definition": "Currently active enrollments"},
    {"name": "sessions_delivered", "category": "output", "unit": "count", "definition": "Total training sessions completed"},
    {"name": "attendance_rate", "category": "output", "unit": "percentage", "definition": "Average attendance across all sessions"},
    {"name": "field_visits_completed", "category": "output", "unit": "count", "definition": "Field officer verification visits completed"},
    {"name": "disbursements_made", "category": "output", "unit": "count", "definition": "Total stipend disbursements processed"},
    {"name": "disbursement_amount", "category": "output", "unit": "KES", "definition": "Total disbursement amount in KES"},
    {"name": "assessments_conducted", "category": "output", "unit": "count", "definition": "Total assessments administered"},
    {"name": "training_hours", "category": "output", "unit": "hours", "definition": "Total training hours delivered"},
    {"name": "mentorship_sessions", "category": "output", "unit": "count", "definition": "One-on-one mentorship sessions held"},
    
    # Outcome indicators
    {"name": "completion_rate", "category": "outcome", "unit": "percentage", "definition": "Beneficiaries who completed program vs enrolled"},
    {"name": "employment_rate", "category": "outcome", "unit": "percentage", "definition": "Completers who gained employment within 6 months"},
    {"name": "retention_rate_90d", "category": "outcome", "unit": "percentage", "definition": "Beneficiaries still active after 90 days"},
    {"name": "retention_rate_180d", "category": "outcome", "unit": "percentage", "definition": "Beneficiaries still active after 180 days"},
    {"name": "dropout_rate", "category": "outcome", "unit": "percentage", "definition": "Beneficiaries who disengaged before completion"},
    {"name": "avg_assessment_score", "category": "outcome", "unit": "percentage", "definition": "Average assessment score across all beneficiaries"},
    {"name": "score_improvement", "category": "outcome", "unit": "percentage_points", "definition": "Average improvement from first to last assessment"},
    {"name": "business_startup_rate", "category": "outcome", "unit": "percentage", "definition": "Completers who started a business"},
    {"name": "further_education_rate", "category": "outcome", "unit": "percentage", "definition": "Completers who enrolled in further education"},
    {"name": "skill_certification_rate", "category": "outcome", "unit": "percentage", "definition": "Beneficiaries who obtained skill certifications"},
    
    # Impact indicators
    {"name": "cost_per_beneficiary", "category": "impact", "unit": "KES", "definition": "Total program cost / beneficiaries served"},
    {"name": "cost_per_outcome", "category": "impact", "unit": "KES", "definition": "Total cost / positive outcomes achieved"},
    {"name": "roi_ratio", "category": "impact", "unit": "ratio", "definition": "Estimated economic return / program investment"},
    {"name": "income_increase_pct", "category": "impact", "unit": "percentage", "definition": "Average income increase for employed completers"},
    {"name": "family_members_impacted", "category": "impact", "unit": "count", "definition": "Estimated family members benefiting indirectly"},
    {"name": "community_projects", "category": "impact", "unit": "count", "definition": "Community projects initiated by beneficiaries"},
    {"name": "peer_mentors_trained", "category": "impact", "unit": "count", "definition": "Beneficiaries who became peer mentors"},
    {"name": "employer_satisfaction", "category": "impact", "unit": "percentage", "definition": "Employer satisfaction with program graduates"},
    {"name": "savings_rate", "category": "impact", "unit": "percentage", "definition": "Completers with active savings accounts"},
    {"name": "loan_access_rate", "category": "impact", "unit": "percentage", "definition": "Completers who accessed formal credit"},
]

DONOR_NAMES = [
    "Gates Foundation Kenya", "USAID Kenya", "DFID East Africa", "Mastercard Foundation",
    "Safaricom Foundation", "Kenya Commercial Bank Foundation", "Equity Group Foundation",
    "Standard Chartered Foundation", "World Bank Kenya", "African Development Bank",
    "UNICEF Kenya", "Save the Children Kenya", "Plan International Kenya",
    "Aga Khan Foundation", "Ford Foundation Africa", "Rockefeller Foundation",
    "Michael and Susan Dell Foundation", "IKEA Foundation", "Skoll Foundation",
    "Omidyar Network", "Acumen Fund", "TechnoServe Kenya", "GIZ Kenya",
    "JICA Kenya", "KOICA Kenya",
]

PROGRAM_NAME_TEMPLATES = {
    "Scholarship": [
        "{county} Secondary School Scholarship Program",
        "{county} Girls Education Initiative",
        "{county} Academic Excellence Scholarship",
        "STEM Scholarship {county}",
        "{county} University Preparatory Program",
    ],
    "Plus": [
        "{county} Youth Leadership Development",
        "{county} Life Skills Enhancement",
        "{county} Entrepreneurship Plus",
        "{county} Community Leadership Program",
        "Plus Mentorship {county}",
    ],
    "Vocational": [
        "{county} Technical Skills Training",
        "{county} Artisan Development Program",
        "Vocational Excellence {county}",
        "{county} Trade Skills Initiative",
        "{county} Hands-On Skills Academy",
    ],
    "Tech": [
        "{county} Digital Skills Bootcamp",
        "{county} Tech Youth Initiative",
        "Code {county}",
        "{county} Software Development Program",
        "{county} ICT Skills Academy",
    ],
}


# ============================================================================
# Helper functions
# ============================================================================

def gen_uuid() -> str:
    return str(uuid.uuid4())


def gen_short_uuid() -> str:
    return uuid.uuid4().hex[:8]


def rand_date(start: datetime, end: datetime) -> datetime:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, max(delta, 0)))


def gen_program_name(pillar: str, county: str) -> str:
    templates = PROGRAM_NAME_TEMPLATES.get(pillar, ["{county} Program"])
    return random.choice(templates).format(county=county)


# ============================================================================
# 1. program.csv — ~200 programs
# ============================================================================

def build_programs() -> list[dict]:
    programs = []
    
    # Generate 4-6 programs per pillar per county
    for pillar in PILLARS:
        for county in COUNTIES:
            n_programs = random.randint(4, 6)
            for i in range(n_programs):
                # Programs start at different times over the past 3 years
                start_date = rand_date(TODAY - timedelta(days=1095), TODAY - timedelta(days=90))
                
                # Some programs are completed, most are active
                status = random.choices(
                    ["active", "completed", "planned"],
                    weights=[0.65, 0.25, 0.10]
                )[0]
                
                end_date = None
                if status == "completed":
                    end_date = rand_date(start_date + timedelta(days=180), TODAY - timedelta(days=30))
                elif status == "planned":
                    start_date = rand_date(TODAY + timedelta(days=30), TODAY + timedelta(days=180))
                
                programs.append({
                    "program_id": f"PROG-{gen_short_uuid()}",
                    "pillar": pillar,
                    "name": gen_program_name(pillar, county),
                    "county": county,
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d") if end_date else None,
                    "target_capacity": random.randint(50, 300),
                    "status": status,
                    "description": fake.sentence(nb_words=12),
                })
    
    return programs


# ============================================================================
# 2. donor.csv — ~25 donors
# ============================================================================

def build_donors() -> list[dict]:
    donors = []
    
    for name in DONOR_NAMES:
        donors.append({
            "donor_id": f"DONOR-{gen_short_uuid()}",
            "name": name,
            "contact_email": f"partnerships@{name.lower().replace(' ', '').replace('.', '')[:15]}.org",
            "donor_type": random.choice(DONOR_TYPES),
            "is_active": random.random() > 0.1,  # 90% active
        })
    
    return donors


# ============================================================================
# 3. donor_funding.csv — ~500 funding records
# ============================================================================

def build_donor_funding(donors: list[dict], programs: list[dict]) -> list[dict]:
    funding = []
    
    # Each donor funds 5-15 programs
    for donor in donors:
        if not donor["is_active"]:
            continue
            
        n_funded = random.randint(5, 15)
        funded_programs = random.sample(programs, min(n_funded, len(programs)))
        
        for program in funded_programs:
            # Some programs receive multi-year funding
            fiscal_years = random.choices(
                [[2024], [2025], [2026], [2024, 2025], [2025, 2026], [2024, 2025, 2026]],
                weights=[0.10, 0.15, 0.35, 0.15, 0.20, 0.05]
            )[0]
            
            for fy in fiscal_years:
                # Funding amount varies by pillar (Tech/Vocational more expensive)
                base_amount = {
                    "Scholarship": random.randint(2_000_000, 8_000_000),
                    "Plus": random.randint(1_500_000, 5_000_000),
                    "Vocational": random.randint(3_000_000, 12_000_000),
                    "Tech": random.randint(4_000_000, 15_000_000),
                }.get(program["pillar"], 3_000_000)
                
                # Disbursement progress
                if fy < 2026:
                    disbursed_pct = random.uniform(0.85, 1.0)
                    status = "completed"
                elif fy == 2026:
                    disbursed_pct = random.uniform(0.3, 0.75)
                    status = random.choice(["active", "active", "suspended"]) if disbursed_pct < 0.5 else "active"
                else:
                    disbursed_pct = 0
                    status = "active"
                
                funding.append({
                    "id": f"FUND-{gen_short_uuid()}",
                    "donor_id": donor["donor_id"],
                    "program_id": program["program_id"],
                    "amount_kes": base_amount,
                    "currency": "KES",
                    "fiscal_year": fy,
                    "disbursed_to_date": round(base_amount * disbursed_pct),
                    "funding_status": status,
                })
    
    return funding


# ============================================================================
# 4. resource_allocation.csv — ~1000 allocations
# ============================================================================

def build_resource_allocations(programs: list[dict]) -> list[dict]:
    allocations = []
    
    for program in programs:
        if program["status"] == "planned":
            continue
            
        # Each program has 2-5 allocation periods
        n_periods = random.randint(2, 5)
        
        for period_idx in range(n_periods):
            period_start = rand_date(
                datetime.strptime(program["start_date"], "%Y-%m-%d"),
                TODAY - timedelta(days=90)
            )
            period_end = period_start + timedelta(days=random.randint(60, 120))
            
            for resource_type in RESOURCE_TYPES:
                # Not every period has every resource type
                if random.random() > 0.7:
                    continue
                
                if resource_type == "field_officer":
                    amount = random.randint(1, 5)
                    unit = "officers"
                elif resource_type == "training_capacity":
                    amount = random.randint(20, 100)
                    unit = "seats"
                else:  # budget
                    amount = random.randint(100_000, 2_000_000)
                    unit = "KES"
                
                source = random.choices(
                    ["manual", "ml_recommended"],
                    weights=[0.75, 0.25]
                )[0]
                
                status = "approved"
                if source == "ml_recommended":
                    status = random.choices(
                        ["pending", "approved", "rejected"],
                        weights=[0.30, 0.55, 0.15]
                    )[0]
                
                allocations.append({
                    "id": f"ALLOC-{gen_short_uuid()}",
                    "program_id": program["program_id"],
                    "region": program["county"],
                    "resource_type": resource_type,
                    "allocated_amount": amount,
                    "unit": unit,
                    "period_start": period_start.strftime("%Y-%m-%d"),
                    "period_end": period_end.strftime("%Y-%m-%d"),
                    "source": source,
                    "status": status,
                    "priority_score": round(random.uniform(20, 90), 2) if source == "ml_recommended" else None,
                    "rationale": fake.sentence(nb_words=8) if source == "ml_recommended" else None,
                })
    
    return allocations


# ============================================================================
# 5. indicator.csv — ~30 M&E indicators
# ============================================================================

def build_indicators() -> list[dict]:
    indicators = []
    
    for idx, ind_def in enumerate(INDICATOR_DEFINITIONS):
        indicators.append({
            "indicator_id": f"IND-{gen_short_uuid()}",
            "name": ind_def["name"],
            "category": ind_def["category"],
            "unit": ind_def["unit"],
            "definition": ind_def["definition"],
            "version": 1,
            "is_active": True,
        })
    
    return indicators


# ============================================================================
# 6. measurement.csv — ~50000 measurements
# ============================================================================

def build_measurements(indicators: list[dict], programs: list[dict]) -> list[dict]:
    measurements = []
    
    # Generate measurements for each indicator at program/county/pillar level
    # over the past 12 months
    months = pd.date_range(
        start=TODAY - timedelta(days=365),
        end=TODAY,
        freq="MS"
    ).to_pydatetime().tolist()
    
    for indicator in indicators:
        # Not all indicators have measurements at all scopes
        scope_weights = {
            "output": {"program": 0.6, "county": 0.3, "pillar": 0.1},
            "outcome": {"program": 0.4, "county": 0.4, "pillar": 0.2},
            "impact": {"program": 0.3, "county": 0.3, "pillar": 0.4},
        }
        weights = scope_weights.get(indicator["category"], {"program": 0.5, "county": 0.3, "pillar": 0.2})
        
        # Program-level measurements
        if random.random() < weights["program"]:
            sampled_programs = random.sample(programs, min(30, len(programs)))
            for program in sampled_programs:
                for month_start in months:
                    if random.random() > 0.7:  # Skip some months
                        continue
                    
                    measurements.append({
                        "id": f"MEAS-{gen_short_uuid()}",
                        "indicator_id": indicator["indicator_id"],
                        "program_id": program["program_id"],
                        "cohort_id": None,
                        "county": program["county"],
                        "pillar": program["pillar"],
                        "period_start": month_start.strftime("%Y-%m-%d"),
                        "period_end": (month_start + timedelta(days=30)).strftime("%Y-%m-%d"),
                        "value": _generate_indicator_value(indicator, program),
                    })
        
        # County-level measurements
        if random.random() < weights["county"]:
            for county in COUNTIES:
                for month_start in months:
                    if random.random() > 0.6:
                        continue
                    
                    measurements.append({
                        "id": f"MEAS-{gen_short_uuid()}",
                        "indicator_id": indicator["indicator_id"],
                        "program_id": None,
                        "cohort_id": None,
                        "county": county,
                        "pillar": None,
                        "period_start": month_start.strftime("%Y-%m-%d"),
                        "period_end": (month_start + timedelta(days=30)).strftime("%Y-%m-%d"),
                        "value": _generate_indicator_value(indicator, None, county=county),
                    })
        
        # Pillar-level measurements
        if random.random() < weights["pillar"]:
            for pillar in PILLARS:
                for month_start in months:
                    if random.random() > 0.5:
                        continue
                    
                    measurements.append({
                        "id": f"MEAS-{gen_short_uuid()}",
                        "indicator_id": indicator["indicator_id"],
                        "program_id": None,
                        "cohort_id": None,
                        "county": None,
                        "pillar": pillar,
                        "period_start": month_start.strftime("%Y-%m-%d"),
                        "period_end": (month_start + timedelta(days=30)).strftime("%Y-%m-%d"),
                        "value": _generate_indicator_value(indicator, None, pillar=pillar),
                    })
    
    return measurements


def _generate_indicator_value(indicator: dict, program: dict = None, county: str = None, pillar: str = None) -> float:
    """Generate a realistic value based on indicator type."""
    name = indicator["name"]
    unit = indicator["unit"]
    
    # Base multiplier for scope
    multiplier = 1.0
    if pillar:
        multiplier = 5.0  # Pillar aggregates are larger
    elif county:
        multiplier = 2.5  # County aggregates medium
    
    # Generate based on indicator name/type
    if "rate" in name or unit == "percentage":
        # Percentages between 50-95% generally
        base = random.gauss(72, 12)
        return round(max(20, min(100, base)), 2)
    
    elif "cost" in name and "per" in name:
        # Cost per X indicators
        if "beneficiary" in name:
            return round(random.uniform(35000, 65000), 0)
        else:
            return round(random.uniform(50000, 85000), 0)
    
    elif unit == "count":
        # Count indicators
        if "enrolled" in name:
            base = random.randint(50, 200)
        elif "sessions" in name:
            base = random.randint(10, 50)
        elif "visits" in name:
            base = random.randint(5, 30)
        elif "disbursements" in name:
            base = random.randint(30, 150)
        else:
            base = random.randint(10, 100)
        return round(base * multiplier)
    
    elif unit == "KES":
        return round(random.uniform(100000, 5000000) * multiplier, 0)
    
    elif unit == "hours":
        return round(random.uniform(50, 500) * multiplier, 0)
    
    elif unit == "ratio":
        return round(random.uniform(1.5, 4.5), 2)
    
    elif "percentage_points" in unit:
        return round(random.gauss(8, 5), 2)
    
    else:
        return round(random.uniform(10, 100), 2)


# ============================================================================
# Main
# ============================================================================

def main():
    print("Inuka Pulse — Extended Data Generator")
    print("=" * 50)
    
    # Check if base data exists
    cohorts_path = OUT_DIR / "dim_cohort.csv"
    if not cohorts_path.exists():
        print(f"ERROR: {cohorts_path} not found.")
        print("Run generate_inuka_data.py first to create base data.")
        return
    
    print("Building programs…")
    programs = build_programs()
    
    print("Building donors…")
    donors = build_donors()
    
    print("Building donor funding…")
    funding = build_donor_funding(donors, programs)
    
    print("Building resource allocations…")
    allocations = build_resource_allocations(programs)
    
    print("Building indicators…")
    indicators = build_indicators()
    
    print("Building measurements…")
    measurements = build_measurements(indicators, programs)
    
    # ── Write CSVs ────────────────────────────────────────────────────────────
    datasets = {
        "program.csv": programs,
        "donor.csv": donors,
        "donor_funding.csv": funding,
        "resource_allocation.csv": allocations,
        "indicator.csv": indicators,
        "measurement.csv": measurements,
    }
    
    for fname, rows in datasets.items():
        if not rows:
            print(f"  SKIP {fname} (empty)")
            continue
        df = pd.DataFrame(rows)
        path = OUT_DIR / fname
        df.to_csv(path, index=False)
        print(f"  {fname}: {len(df):>6,} rows → {path}")
    
    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print(f"Programs           : {len(programs):>6,}")
    print(f"Donors             : {len(donors):>6,}")
    print(f"Funding records    : {len(funding):>6,}")
    print(f"Allocations        : {len(allocations):>6,}")
    print(f"Indicators         : {len(indicators):>6,}")
    print(f"Measurements       : {len(measurements):>6,}")
    
    # Funding stats
    total_funding = sum(f["amount_kes"] for f in funding)
    total_disbursed = sum(f["disbursed_to_date"] for f in funding)
    print(f"\nTotal funding      : KES {total_funding:>15,}")
    print(f"Total disbursed    : KES {total_disbursed:>15,}")
    print(f"Disbursement rate  : {total_disbursed/total_funding*100:.1f}%")
    print("=" * 50)
    print("Done. Output in data/raw/inuka/")


if __name__ == "__main__":
    main()
