"""
Inuka Pulse — Model 5: Allocation Optimizer
============================================
Generates resource allocation recommendations using a transparent weighted
scoring formula over Model 2-4 outputs.

NOTE: This is NOT a trained ML model. It's an explainable scoring formula
that combines forecasts from other models into actionable recommendations.

Formula:
    priority_score = (
        w_demand × demand_score +
        w_capacity × capacity_gap_score +
        w_outcome × outcome_risk_score -
        w_funding × funding_penalty
    )

Where:
    - demand_score: normalized demand forecast (from Model 2)
    - capacity_gap_score: (1 - utilization) normalized
    - outcome_risk_score: (1 - avg_completion_probability) from Model 4
    - funding_penalty: funding gap normalized

Default weights (configurable):
    w_demand = 0.30
    w_capacity = 0.25
    w_outcome = 0.25
    w_funding = 0.20

Output: Ranked list of (county, pillar, resource_type) recommendations
with priority scores, component breakdowns, and human-readable rationales.

Usage:
    python -m src.models.allocation_optimizer --generate
    python -m src.models.allocation_optimizer --generate --weights 0.35,0.25,0.25,0.15
"""

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# ── Paths ─────────────────────────────────────────────────────────────────────
RAW_DIR = Path("data/raw/inuka")
WAREHOUSE_DIR = Path("data/warehouse")


# ══════════════════════════════════════════════════════════════════════════════
# DATA LOADING
# ══════════════════════════════════════════════════════════════════════════════

def load_demand_forecasts() -> pd.DataFrame:
    """Load demand forecasts from Model 2."""
    path = WAREHOUSE_DIR / "demand_forecasts.json"
    if path.exists():
        with open(path) as f:
            data = json.load(f)
        return pd.DataFrame(data.get("forecasts", []))
    return pd.DataFrame()


def load_outcome_predictions() -> pd.DataFrame:
    """Load outcome predictions from Model 4."""
    path = WAREHOUSE_DIR / "outcome_predictions.json"
    if path.exists():
        with open(path) as f:
            data = json.load(f)
        return pd.DataFrame(data.get("predictions", []))
    return pd.DataFrame()


def load_programs() -> pd.DataFrame:
    """Load program data."""
    path = RAW_DIR / "program.csv"
    if path.exists():
        return pd.read_csv(path)
    return pd.DataFrame()


def load_funding() -> pd.DataFrame:
    """Load funding data."""
    path = RAW_DIR / "donor_funding.csv"
    if path.exists():
        return pd.read_csv(path)
    return pd.DataFrame()


def load_allocations() -> pd.DataFrame:
    """Load current allocations."""
    path = RAW_DIR / "resource_allocation.csv"
    if path.exists():
        return pd.read_csv(path)
    return pd.DataFrame()


# ══════════════════════════════════════════════════════════════════════════════
# SCORE COMPUTATION
# ══════════════════════════════════════════════════════════════════════════════

def compute_allocation_scores(
    programs: pd.DataFrame,
    funding: pd.DataFrame,
    allocations: pd.DataFrame,
    demand_forecasts: pd.DataFrame,
    outcome_predictions: pd.DataFrame,
    weights: tuple[float, float, float, float] = (0.30, 0.25, 0.25, 0.20),
) -> pd.DataFrame:
    """
    Compute allocation priority scores for each county-pillar combination.
    
    Returns DataFrame with:
        - county, pillar
        - demand_score, capacity_gap_score, outcome_risk_score, funding_penalty
        - priority_score
        - component_breakdown (dict)
        - rationale (text)
    """
    w_demand, w_capacity, w_outcome, w_funding = weights
    
    if programs.empty:
        print("No program data available")
        return pd.DataFrame()
    
    # Get active programs
    active_programs = programs[programs["status"] == "active"]
    
    # Aggregate by county-pillar
    county_pillar = active_programs.groupby(["county", "pillar"]).agg({
        "program_id": "count",
        "target_capacity": "sum",
    }).rename(columns={
        "program_id": "program_count",
        "target_capacity": "total_capacity",
    }).reset_index()
    
    # ── Demand Score ──────────────────────────────────────────────────────────
    if not demand_forecasts.empty:
        # Use 1-month horizon forecasts
        demand_1m = demand_forecasts[demand_forecasts["horizon_months"] == 1]
        demand_by_cp = demand_1m.groupby(["county", "pillar"])["forecast_enrollment"].sum()
        county_pillar = county_pillar.merge(
            demand_by_cp.rename("forecast_demand"),
            on=["county", "pillar"],
            how="left"
        )
    else:
        # Fallback: use capacity as proxy
        county_pillar["forecast_demand"] = county_pillar["total_capacity"] * 0.8
    
    county_pillar["forecast_demand"] = county_pillar["forecast_demand"].fillna(
        county_pillar["total_capacity"] * 0.8
    )
    
    # Normalize demand score: demand / capacity (0-1 scale, capped at 1.5)
    county_pillar["demand_score"] = (
        county_pillar["forecast_demand"] / county_pillar["total_capacity"].clip(lower=1)
    ).clip(0, 1.5) * (100 / 1.5)  # Scale to 0-100
    
    # ── Capacity Gap Score ────────────────────────────────────────────────────
    # Higher score = more unused capacity (opportunity)
    # Estimate current enrollment (placeholder - would come from real data)
    county_pillar["estimated_enrollment"] = county_pillar["total_capacity"] * 0.75
    county_pillar["utilization"] = (
        county_pillar["estimated_enrollment"] / county_pillar["total_capacity"].clip(lower=1)
    ).clip(0, 1)
    county_pillar["capacity_gap_score"] = (1 - county_pillar["utilization"]) * 100
    
    # ── Outcome Risk Score ────────────────────────────────────────────────────
    if not outcome_predictions.empty:
        outcome_by_cp = outcome_predictions.groupby(["county", "pillar"]).agg({
            "completion_probability": "mean",
            "beneficiary_id": "count",
        }).rename(columns={
            "completion_probability": "avg_completion_prob",
            "beneficiary_id": "beneficiary_count",
        })
        county_pillar = county_pillar.merge(
            outcome_by_cp,
            on=["county", "pillar"],
            how="left"
        )
    else:
        county_pillar["avg_completion_prob"] = 0.75
        county_pillar["beneficiary_count"] = 0
    
    county_pillar["avg_completion_prob"] = county_pillar["avg_completion_prob"].fillna(0.75)
    # Higher risk = lower completion probability
    county_pillar["outcome_risk_score"] = (1 - county_pillar["avg_completion_prob"]) * 100
    
    # ── Funding Penalty ───────────────────────────────────────────────────────
    if not funding.empty:
        # Aggregate funding by program, then by county-pillar
        funding_with_program = funding.merge(
            programs[["program_id", "county", "pillar"]],
            on="program_id",
            how="left"
        )
        funding_by_cp = funding_with_program.groupby(["county", "pillar"]).agg({
            "amount_kes": "sum",
            "disbursed_to_date": "sum",
        })
        funding_by_cp["funding_gap"] = funding_by_cp["amount_kes"] - funding_by_cp["disbursed_to_date"]
        
        county_pillar = county_pillar.merge(
            funding_by_cp[["funding_gap"]],
            on=["county", "pillar"],
            how="left"
        )
    else:
        county_pillar["funding_gap"] = 0
    
    county_pillar["funding_gap"] = county_pillar["funding_gap"].fillna(0)
    # Normalize funding penalty (larger gap = more funding needed = less priority)
    max_gap = county_pillar["funding_gap"].abs().max()
    county_pillar["funding_penalty"] = (
        county_pillar["funding_gap"].clip(lower=0) / max(max_gap, 1) * 50
    ) if max_gap > 0 else 0
    
    # ── Compute Priority Score ────────────────────────────────────────────────
    county_pillar["priority_score"] = (
        w_demand * county_pillar["demand_score"] +
        w_capacity * county_pillar["capacity_gap_score"] +
        w_outcome * county_pillar["outcome_risk_score"] -
        w_funding * county_pillar["funding_penalty"]
    ).clip(lower=0)
    
    # ── Component Breakdown ───────────────────────────────────────────────────
    county_pillar["component_breakdown"] = county_pillar.apply(
        lambda row: {
            "demand_contribution": round(w_demand * row["demand_score"], 2),
            "capacity_contribution": round(w_capacity * row["capacity_gap_score"], 2),
            "outcome_risk_contribution": round(w_outcome * row["outcome_risk_score"], 2),
            "funding_penalty": round(w_funding * row["funding_penalty"], 2),
        },
        axis=1
    )
    
    # ── Generate Rationale ────────────────────────────────────────────────────
    county_pillar["rationale"] = county_pillar.apply(generate_rationale, axis=1)
    
    # Sort by priority
    county_pillar = county_pillar.sort_values("priority_score", ascending=False)
    
    return county_pillar


def generate_rationale(row: pd.Series) -> str:
    """Generate human-readable rationale for recommendation."""
    factors = []
    
    if row["demand_score"] > 60:
        factors.append("high projected demand")
    elif row["demand_score"] > 40:
        factors.append("moderate demand growth")
    
    if row["capacity_gap_score"] > 40:
        factors.append("significant unused capacity")
    
    if row["outcome_risk_score"] > 50:
        factors.append("elevated completion risk")
    elif row["outcome_risk_score"] > 30:
        factors.append("moderate outcome concerns")
    
    if row["funding_penalty"] > 20:
        factors.append("funding constraints")
    
    if not factors:
        return "Balanced priority across all factors."
    
    return f"Priority driven by: {', '.join(factors)}."


# ══════════════════════════════════════════════════════════════════════════════
# RECOMMENDATION GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def generate_recommendations(
    scores: pd.DataFrame,
    resource_types: list[str] = ["field_officer", "training_capacity", "budget"],
    top_n: int = 20,
) -> list[dict]:
    """
    Generate specific resource allocation recommendations.
    
    Returns list of recommendations with:
        - county, pillar, resource_type
        - priority_score, confidence
        - current_allocation, recommended_allocation, change_percent
        - rationale
    """
    if scores.empty:
        return []
    
    recommendations = []
    
    for _, row in scores.head(top_n).iterrows():
        for resource_type in resource_types:
            # Determine recommended change based on priority
            # Use relative thresholds based on score distribution
            max_score = scores["priority_score"].max()
            high_threshold = max_score * 0.8
            medium_threshold = max_score * 0.6
            
            if row["priority_score"] >= high_threshold:
                change_pct = 20  # 20% increase
            elif row["priority_score"] >= medium_threshold:
                change_pct = 10  # 10% increase
            else:
                change_pct = 5  # 5% modest increase for lower priority
            
            if change_pct == 0:
                continue
            
            # Estimate current and recommended allocations
            if resource_type == "field_officer":
                current = max(1, int(row["program_count"] * 0.5))
                recommended = int(current * (1 + change_pct / 100))
                unit = "officers"
            elif resource_type == "training_capacity":
                current = int(row["total_capacity"] * 0.1)
                recommended = int(current * (1 + change_pct / 100))
                unit = "slots"
            else:  # budget
                current = int(row.get("funding_gap", 0) * 0.1)
                recommended = int(current * (1 + change_pct / 100))
                unit = "KES"
            
            recommendations.append({
                "id": f"REC-{len(recommendations)+1:04d}",
                "county": row["county"],
                "pillar": row["pillar"],
                "resource_type": resource_type,
                "current_allocation": current,
                "recommended_allocation": recommended,
                "change_amount": recommended - current,
                "change_percent": change_pct,
                "unit": unit,
                "priority_score": round(row["priority_score"], 2),
                "confidence": min(0.95, 0.7 + row["priority_score"] / 200),
                "demand_forecast": round(row.get("forecast_demand", 0)),
                "capacity_utilization": round(row.get("utilization", 0.75), 2),
                "outcome_risk": round(row.get("outcome_risk_score", 0) / 100, 2),
                "rationale": row["rationale"],
                "component_breakdown": row["component_breakdown"],
                "status": "pending",
                "generated_at": datetime.now().isoformat(),
            })
    
    return recommendations


def export_recommendations(recommendations: list[dict], scores: pd.DataFrame):
    """Export recommendations to JSON for backend consumption."""
    export = {
        "generated_at": datetime.now().isoformat(),
        "model_version": "v1.0",
        "algorithm": "weighted_scoring",
        "weights": {
            "demand": 0.30,
            "capacity_gap": 0.25,
            "outcome_risk": 0.25,
            "funding_penalty": 0.20,
        },
        "summary": {
            "total_recommendations": len(recommendations),
            "high_priority": len([r for r in recommendations if r["priority_score"] > 50]),
            "medium_priority": len([r for r in recommendations if 30 <= r["priority_score"] <= 50]),
            "counties_covered": len(scores["county"].unique()),
            "pillars_covered": len(scores["pillar"].unique()),
        },
        "recommendations": recommendations,
    }
    
    export_path = WAREHOUSE_DIR / "allocation_recommendations.json"
    with open(export_path, "w") as f:
        json.dump(export, f, indent=2)
    
    print(f"Recommendations exported: {export_path}")
    return export_path


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Inuka Pulse — Allocation Optimizer (Model 5)")
    parser.add_argument("--generate", action="store_true", help="Generate recommendations")
    parser.add_argument("--weights", type=str, default="0.30,0.25,0.25,0.20",
                       help="Weights: demand,capacity,outcome,funding (comma-separated)")
    parser.add_argument("--top-n", type=int, default=20,
                       help="Number of top county-pillars to recommend")
    args = parser.parse_args()
    
    if args.generate:
        print("Inuka Pulse — Allocation Optimizer (Model 5)")
        print("=" * 50)
        print("\nNOTE: This is a weighted scoring formula, not a trained ML model.")
        
        # Parse weights
        weights = tuple(float(w) for w in args.weights.split(","))
        print(f"\nWeights: demand={weights[0]}, capacity={weights[1]}, "
              f"outcome={weights[2]}, funding={weights[3]}")
        
        # Load data
        print("\nLoading data…")
        programs = load_programs()
        funding = load_funding()
        allocations = load_allocations()
        demand_forecasts = load_demand_forecasts()
        outcome_predictions = load_outcome_predictions()
        
        print(f"  Programs: {len(programs)}")
        print(f"  Funding records: {len(funding)}")
        print(f"  Current allocations: {len(allocations)}")
        print(f"  Demand forecasts: {len(demand_forecasts)}")
        print(f"  Outcome predictions: {len(outcome_predictions)}")
        
        # Compute scores
        print("\nComputing priority scores…")
        scores = compute_allocation_scores(
            programs, funding, allocations,
            demand_forecasts, outcome_predictions,
            weights=weights,
        )
        
        if scores.empty:
            print("ERROR: No scores computed")
            return
        
        print(f"\nScored {len(scores)} county-pillar combinations")
        print("\nTop 10 by priority:")
        print(scores[["county", "pillar", "priority_score", "rationale"]].head(10).to_string())
        
        # Generate recommendations
        print("\nGenerating recommendations…")
        recommendations = generate_recommendations(scores, top_n=args.top_n)
        
        print(f"Generated {len(recommendations)} recommendations")
        
        # Export
        export_recommendations(recommendations, scores)
        
        print("\nDone.")
    else:
        print("Use --generate to create allocation recommendations")


if __name__ == "__main__":
    main()
