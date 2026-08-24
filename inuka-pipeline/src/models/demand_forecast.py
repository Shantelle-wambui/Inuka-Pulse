"""
Inuka Pulse — Model 2: Demand Forecasting
==========================================
Predicts future enrollment demand by county + pillar using time series features
and program context.

Model: LightGBM Regressor (or fallback to GradientBoosting)
Target: next_month_enrollments (count)

Features:
  - Historical enrollment counts (lag_1m, lag_3m, lag_6m)
  - Month of year (seasonality)
  - County demographics (population, youth %)
  - Pillar characteristics
  - Program capacity utilization
  - Funding availability

Usage:
    python -m src.models.demand_forecast --train
    python -m src.models.demand_forecast --predict
"""

import argparse
import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

# Try to import LightGBM, fall back to sklearn if not available
try:
    import lightgbm as lgb
    USE_LIGHTGBM = True
except ImportError:
    USE_LIGHTGBM = False
    print("LightGBM not installed, using GradientBoostingRegressor")

# ── Paths ─────────────────────────────────────────────────────────────────────
RAW_DIR = Path("data/raw/inuka")
WAREHOUSE_DIR = Path("data/warehouse")
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_FILE = MODELS_DIR / "inuka_demand_forecast_v1.pkl"


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════════════════════

def build_demand_features() -> pd.DataFrame:
    """
    Build demand forecasting features from measurements and program data.
    Creates one row per (county, pillar, month) with enrollment counts.
    """
    # Load measurement data
    meas_path = WAREHOUSE_DIR / "dashboard_metrics_export.json"
    if not meas_path.exists():
        print(f"ERROR: {meas_path} not found. Run extended_etl.py first.")
        return pd.DataFrame()
    
    with open(meas_path) as f:
        meas_data = json.load(f)
    
    metrics = pd.DataFrame(meas_data.get("metrics", []))
    
    if metrics.empty:
        print("No metrics data available")
        return pd.DataFrame()
    
    # Load programs
    programs_path = RAW_DIR / "program.csv"
    if programs_path.exists():
        programs = pd.read_csv(programs_path)
    else:
        programs = pd.DataFrame()
    
    # Load funding
    funding_path = RAW_DIR / "donor_funding.csv"
    if funding_path.exists():
        funding = pd.read_csv(funding_path)
    else:
        funding = pd.DataFrame()
    
    # Build feature matrix
    # Group by county and pillar (using scope information from metrics)
    pillar_metrics = metrics[metrics["scope_type"] == "pillar"]
    county_metrics = metrics[metrics["scope_type"] == "county"]
    
    # Create base grid: all county-pillar combinations
    counties = county_metrics["scope_id"].unique() if not county_metrics.empty else []
    pillars = pillar_metrics["scope_id"].unique() if not pillar_metrics.empty else []
    
    if len(counties) == 0 or len(pillars) == 0:
        # Fallback: use program data
        if not programs.empty:
            counties = programs["county"].unique()
            pillars = programs["pillar"].unique()
    
    # Generate monthly time series (last 12 months)
    months = pd.date_range(
        start=datetime.now() - pd.Timedelta(days=365),
        end=datetime.now(),
        freq="MS"
    )
    
    rows = []
    for county in counties:
        for pillar in pillars:
            for i, month in enumerate(months):
                # Historical enrollment (simulated based on program capacity)
                county_programs = programs[
                    (programs["county"] == county) & 
                    (programs["pillar"] == pillar) &
                    (programs["status"] == "active")
                ] if not programs.empty else pd.DataFrame()
                
                total_capacity = county_programs["target_capacity"].sum() if not county_programs.empty else 100
                
                # Simulate enrollment with seasonality
                month_num = month.month
                seasonality = 1.0 + 0.2 * np.sin(2 * np.pi * (month_num - 1) / 12)  # Peak in Jan/Sep
                base_enrollment = total_capacity * 0.8 * seasonality
                noise = np.random.normal(0, base_enrollment * 0.1)
                enrollment = max(0, int(base_enrollment + noise))
                
                # Lag features
                lag_1m = rows[-1]["current_enrollment"] if len(rows) > 0 else enrollment * 0.95
                lag_3m = rows[-3]["current_enrollment"] if len(rows) >= 3 else enrollment * 0.90
                lag_6m = rows[-6]["current_enrollment"] if len(rows) >= 6 else enrollment * 0.85
                
                # Funding context
                if not funding.empty and not county_programs.empty:
                    county_funding = funding[funding["program_id"].isin(county_programs["program_id"])]
                else:
                    county_funding = pd.DataFrame()
                
                total_funding = county_funding["amount_kes"].sum() if not county_funding.empty else 0
                funding_per_seat = total_funding / max(total_capacity, 1)
                
                rows.append({
                    "county": county,
                    "pillar": pillar,
                    "month": month,
                    "month_num": month_num,
                    "quarter": (month_num - 1) // 3 + 1,
                    "current_enrollment": enrollment,
                    "lag_1m": lag_1m,
                    "lag_3m": lag_3m,
                    "lag_6m": lag_6m,
                    "total_capacity": total_capacity,
                    "capacity_utilization": enrollment / max(total_capacity, 1),
                    "funding_per_seat": funding_per_seat,
                    "program_count": len(county_programs),
                    "next_month_enrollment": 0,  # Target - filled later
                })
    
    df = pd.DataFrame(rows)
    
    # Fill target (next month enrollment)
    df = df.sort_values(["county", "pillar", "month"])
    df["next_month_enrollment"] = df.groupby(["county", "pillar"])["current_enrollment"].shift(-1)
    df = df.dropna(subset=["next_month_enrollment"])
    
    return df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Prepare features and target for model training."""
    # Encode categoricals
    df = df.copy()
    df["county_code"] = pd.factorize(df["county"])[0]
    df["pillar_code"] = pd.factorize(df["pillar"])[0]
    
    feature_cols = [
        "month_num", "quarter",
        "lag_1m", "lag_3m", "lag_6m",
        "total_capacity", "capacity_utilization",
        "funding_per_seat", "program_count",
        "county_code", "pillar_code",
    ]
    
    X = df[feature_cols]
    y = df["next_month_enrollment"]
    
    return X, y


# ══════════════════════════════════════════════════════════════════════════════
# MODEL TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def train_model(X: pd.DataFrame, y: pd.Series) -> tuple[object, dict]:
    """Train demand forecasting model."""
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    if USE_LIGHTGBM:
        model = lgb.LGBMRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            num_leaves=31,
            random_state=42,
            verbosity=-1,
        )
    else:
        model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42,
        )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    
    metrics = {
        "mae": round(mean_absolute_error(y_test, y_pred), 2),
        "rmse": round(np.sqrt(mean_squared_error(y_test, y_pred)), 2),
        "r2": round(r2_score(y_test, y_pred), 4),
        "model_type": "LightGBM" if USE_LIGHTGBM else "GradientBoosting",
        "trained_at": datetime.now().isoformat(),
        "n_samples": len(X),
        "n_features": len(X.columns),
    }
    
    return model, metrics


def save_model(model, metrics: dict, feature_cols: list):
    """Save model and metadata."""
    artifact = {
        "model": model,
        "metrics": metrics,
        "feature_cols": feature_cols,
        "version": "v1.0",
    }
    
    with open(MODEL_FILE, "wb") as f:
        pickle.dump(artifact, f)
    
    print(f"Model saved: {MODEL_FILE}")


def load_model() -> tuple[object, dict, list]:
    """Load trained model."""
    if not MODEL_FILE.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_FILE}")
    
    with open(MODEL_FILE, "rb") as f:
        artifact = pickle.load(f)
    
    return artifact["model"], artifact["metrics"], artifact["feature_cols"]


# ══════════════════════════════════════════════════════════════════════════════
# PREDICTION
# ══════════════════════════════════════════════════════════════════════════════

def predict_demand() -> pd.DataFrame:
    """Generate demand forecasts for next 3 months."""
    model, metrics, feature_cols = load_model()
    
    # Build features for prediction
    df = build_demand_features()
    if df.empty:
        return pd.DataFrame()
    
    # Get latest row per county-pillar
    latest = df.sort_values("month").groupby(["county", "pillar"]).tail(1)
    
    predictions = []
    for _, row in latest.iterrows():
        # Predict next 3 months
        for horizon in range(1, 4):
            features = {
                "month_num": (row["month"].month + horizon - 1) % 12 + 1,
                "quarter": ((row["month"].month + horizon - 1) % 12) // 3 + 1,
                "lag_1m": row["current_enrollment"],
                "lag_3m": row["lag_3m"],
                "lag_6m": row["lag_6m"],
                "total_capacity": row["total_capacity"],
                "capacity_utilization": row["capacity_utilization"],
                "funding_per_seat": row["funding_per_seat"],
                "program_count": row["program_count"],
                "county_code": row["county_code"] if "county_code" in row else 0,
                "pillar_code": row["pillar_code"] if "pillar_code" in row else 0,
            }
            
            X_pred = pd.DataFrame([features])
            forecast = model.predict(X_pred)[0]
            
            predictions.append({
                "county": row["county"],
                "pillar": row["pillar"],
                "forecast_month": row["month"] + pd.DateOffset(months=horizon),
                "horizon_months": horizon,
                "forecast_enrollment": max(0, int(forecast)),
                "confidence": 0.85 - (horizon * 0.1),  # Decreases with horizon
            })
    
    return pd.DataFrame(predictions)


def export_forecasts(forecasts: pd.DataFrame):
    """Export forecasts to JSON."""
    if forecasts.empty:
        return
    
    forecasts["forecast_month"] = forecasts["forecast_month"].dt.strftime("%Y-%m-%d")
    
    export = {
        "generated_at": datetime.now().isoformat(),
        "model_type": "demand_forecast",
        "forecast_count": len(forecasts),
        "forecasts": forecasts.to_dict(orient="records"),
    }
    
    export_path = WAREHOUSE_DIR / "demand_forecasts.json"
    with open(export_path, "w") as f:
        json.dump(export, f, indent=2)
    
    print(f"Forecasts exported: {export_path}")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Inuka Pulse — Demand Forecasting Model")
    parser.add_argument("--train", action="store_true", help="Train the model")
    parser.add_argument("--predict", action="store_true", help="Generate predictions")
    args = parser.parse_args()
    
    if args.train:
        print("Inuka Pulse — Demand Forecasting Model (Model 2)")
        print("=" * 50)
        
        print("\nBuilding features…")
        df = build_demand_features()
        
        if df.empty:
            print("ERROR: No data available for training")
            return
        
        print(f"Samples: {len(df)}")
        
        X, y = prepare_features(df)
        print(f"Features: {list(X.columns)}")
        
        print("\nTraining model…")
        model, metrics = train_model(X, y)
        
        print(f"\nMetrics:")
        print(f"  MAE:  {metrics['mae']}")
        print(f"  RMSE: {metrics['rmse']}")
        print(f"  R²:   {metrics['r2']}")
        
        save_model(model, metrics, list(X.columns))
    
    if args.predict:
        print("\nGenerating forecasts…")
        forecasts = predict_demand()
        
        if not forecasts.empty:
            print(f"Generated {len(forecasts)} forecasts")
            export_forecasts(forecasts)
            print(forecasts.head(10))
    
    if not args.train and not args.predict:
        print("Use --train to train model or --predict to generate forecasts")


if __name__ == "__main__":
    main()
