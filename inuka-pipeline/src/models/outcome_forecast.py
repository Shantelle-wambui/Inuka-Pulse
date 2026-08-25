"""
Inuka Pulse — Model 4: Outcome Forecasting
===========================================
Predicts beneficiary completion probability based on engagement patterns,
program context, and historical outcomes.

Model: XGBoost Classifier (or fallback to GradientBoosting)
Target: will_complete (binary: 1 = completes program, 0 = drops out)

Features:
  - Engagement features (attendance, sessions, disbursements)
  - Program context (capacity, funding, duration)
  - Assessment scores
  - Field visit outcomes
  - Time in program

This model complements Model 1 (Dropout) by focusing on positive outcome
prediction rather than risk scoring.

Usage:
    python -m src.models.outcome_forecast --train
    python -m src.models.outcome_forecast --predict
"""

import argparse
import json
import pickle
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

# Try to import XGBoost, fall back to sklearn if not available
try:
    import xgboost as xgb
    USE_XGBOOST = True
except ImportError:
    USE_XGBOOST = False
    print("XGBoost not installed, using GradientBoostingClassifier")

# ── Paths ─────────────────────────────────────────────────────────────────────
RAW_DIR = Path("data/raw/inuka")
WAREHOUSE_DIR = Path("data/warehouse")
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_FILE = MODELS_DIR / "inuka_outcome_forecast_v1.pkl"


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════════════════════

def build_outcome_features() -> pd.DataFrame:
    """
    Build outcome prediction features from beneficiary data.
    One row per beneficiary with engagement features and outcome label.
    """
    # Load beneficiary features
    features_path = WAREHOUSE_DIR / "fact_beneficiary_features.parquet"
    if not features_path.exists():
        print(f"ERROR: {features_path} not found. Run inuka_features.py first.")
        return pd.DataFrame()
    
    features = pd.read_parquet(features_path)
    
    # Load beneficiary dimension for outcome labels
    ben_path = RAW_DIR / "dim_beneficiary.csv"
    if not ben_path.exists():
        print(f"ERROR: {ben_path} not found.")
        return pd.DataFrame()
    
    beneficiaries = pd.read_csv(ben_path)
    
    # Get latest feature snapshot per beneficiary
    latest_features = features.sort_values("as_of_date").groupby("beneficiary_id").tail(1)
    
    # Merge with beneficiary dimension
    df = latest_features.merge(
        beneficiaries[["beneficiary_id", "current_status", "dropout_date", "enrollment_date"]],
        on="beneficiary_id",
        how="left"
    )
    
    # Create outcome label
    # will_complete = 1 if Active (still in program), 0 if Dropout/Disengaged
    df["will_complete"] = np.where(
        df["current_status"].isin(["Active", "At-Risk"]),
        1,
        0
    )
    
    # Calculate time in program
    df["enrollment_date"] = pd.to_datetime(df["enrollment_date"], errors="coerce")
    df["days_in_program"] = (pd.Timestamp.now() - df["enrollment_date"]).dt.days.clip(lower=0)
    
    # Engagement score (composite)
    df["engagement_score"] = (
        df["attendance_rate_30d"].fillna(0.5) * 0.4 +
        (1 - df["missed_sessions_14d"].clip(0, 5) / 5) * 0.2 +
        (1 - df["disbursement_delay_days"].clip(0, 30) / 30) * 0.2 +
        (df["assessment_score_latest"].fillna(50) / 100) * 0.2
    )
    
    # Risk indicators
    df["high_risk_engagement"] = (
        (df["attendance_rate_30d"].fillna(0) < 0.6) |
        (df["missed_sessions_14d"] > 3) |
        (df["field_visit_gap_days"] > 60)
    ).astype(int)
    
    return df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Prepare features and target for model training."""
    df = df.copy()
    
    # Encode categoricals
    df["pillar_code"] = pd.factorize(df["pillar"])[0]
    df["county_code"] = pd.factorize(df["county"])[0]
    
    feature_cols = [
        # Engagement features
        "attendance_rate_30d",
        "missed_sessions_14d",
        "sessions_attended_30d",
        "sessions_total_30d",
        "disbursement_delay_days",
        "missed_disbursements_60d",
        "days_since_last_contact",
        "field_visit_gap_days",
        "no_contact_visits_90d",
        # Assessment features
        "assessment_score_latest",
        "assessment_score_trend",
        # Derived features
        "days_in_program",
        "engagement_score",
        "high_risk_engagement",
        # Categorical features
        "pillar_code",
        "county_code",
    ]
    
    # Fill NaN values
    for col in feature_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median() if df[col].dtype in ['float64', 'int64'] else 0)
    
    X = df[feature_cols]
    y = df["will_complete"]
    
    return X, y


# ══════════════════════════════════════════════════════════════════════════════
# MODEL TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def train_model(X: pd.DataFrame, y: pd.Series) -> tuple[object, dict]:
    """Train outcome prediction model."""
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    if USE_XGBOOST:
        model = xgb.XGBClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42,
            eval_metric="logloss",
            use_label_encoder=False,
        )
    else:
        model = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=6,
            random_state=42,
        )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
        "auc_roc": round(roc_auc_score(y_test, y_prob), 4),
        "model_type": "XGBoost" if USE_XGBOOST else "GradientBoosting",
        "trained_at": datetime.now().isoformat(),
        "n_samples": len(X),
        "n_features": len(X.columns),
        "positive_rate": round(y.mean(), 4),
    }
    
    # Feature importance
    importances = model.feature_importances_
    feature_importance = [
        {"feature": col, "importance": round(float(imp), 4)}
        for col, imp in sorted(
            zip(X.columns, importances),
            key=lambda x: x[1],
            reverse=True
        )
    ]
    metrics["feature_importance"] = feature_importance[:10]
    
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
    
    # Also save metrics as JSON for backend
    metrics_export = WAREHOUSE_DIR / "outcome_model_metrics.json"
    with open(metrics_export, "w") as f:
        json.dump(metrics, f, indent=2)


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

def predict_outcomes() -> pd.DataFrame:
    """Generate outcome predictions for all active beneficiaries."""
    model, metrics, feature_cols = load_model()
    
    # Build features
    df = build_outcome_features()
    if df.empty:
        return pd.DataFrame()
    
    # Filter to active/at-risk beneficiaries
    active = df[df["current_status"].isin(["Active", "At-Risk"])]
    
    if active.empty:
        print("No active beneficiaries to predict")
        return pd.DataFrame()
    
    X, _ = prepare_features(active)
    
    # Generate predictions
    probabilities = model.predict_proba(X)[:, 1]
    predictions = model.predict(X)
    
    results = active[["beneficiary_id", "cohort_id", "pillar", "county", "current_status"]].copy()
    results["completion_probability"] = probabilities.round(4)
    results["predicted_outcome"] = np.where(predictions == 1, "complete", "at_risk")
    results["confidence"] = np.abs(probabilities - 0.5) * 2  # 0-1 scale
    
    # Classify into risk buckets
    results["risk_bucket"] = pd.cut(
        results["completion_probability"],
        bins=[0, 0.3, 0.5, 0.7, 1.0],
        labels=["high_risk", "moderate_risk", "moderate", "likely_complete"]
    )
    
    return results


def export_predictions(predictions: pd.DataFrame):
    """Export predictions to JSON."""
    if predictions.empty:
        return
    
    # Summary statistics
    summary = {
        "total_predictions": len(predictions),
        "likely_to_complete": int((predictions["completion_probability"] >= 0.7).sum()),
        "moderate": int(((predictions["completion_probability"] >= 0.5) & 
                        (predictions["completion_probability"] < 0.7)).sum()),
        "at_risk": int((predictions["completion_probability"] < 0.5).sum()),
        "avg_completion_probability": round(predictions["completion_probability"].mean(), 4),
    }
    
    # By pillar
    pillar_summary = predictions.groupby("pillar").agg({
        "completion_probability": "mean",
        "beneficiary_id": "count",
    }).rename(columns={
        "completion_probability": "avg_probability",
        "beneficiary_id": "count",
    }).round(4).to_dict(orient="index")
    
    export = {
        "generated_at": datetime.now().isoformat(),
        "model_type": "outcome_forecast",
        "summary": summary,
        "by_pillar": pillar_summary,
        "predictions": predictions.to_dict(orient="records"),
    }
    
    export_path = WAREHOUSE_DIR / "outcome_predictions.json"
    with open(export_path, "w") as f:
        json.dump(export, f, indent=2, default=str)
    
    print(f"Predictions exported: {export_path}")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Inuka Pulse — Outcome Forecasting Model")
    parser.add_argument("--train", action="store_true", help="Train the model")
    parser.add_argument("--predict", action="store_true", help="Generate predictions")
    args = parser.parse_args()
    
    if args.train:
        print("Inuka Pulse — Outcome Forecasting Model (Model 4)")
        print("=" * 50)
        
        print("\nBuilding features…")
        df = build_outcome_features()
        
        if df.empty:
            print("ERROR: No data available for training")
            return
        
        print(f"Samples: {len(df)}")
        print(f"Positive rate: {df['will_complete'].mean():.2%}")
        
        X, y = prepare_features(df)
        print(f"Features: {len(X.columns)}")
        
        print("\nTraining model…")
        model, metrics = train_model(X, y)
        
        print(f"\nMetrics:")
        print(f"  Accuracy:  {metrics['accuracy']}")
        print(f"  Precision: {metrics['precision']}")
        print(f"  Recall:    {metrics['recall']}")
        print(f"  F1:        {metrics['f1']}")
        print(f"  AUC-ROC:   {metrics['auc_roc']}")
        
        print(f"\nTop features:")
        for feat in metrics["feature_importance"][:5]:
            print(f"  {feat['feature']}: {feat['importance']:.4f}")
        
        save_model(model, metrics, list(X.columns))
    
    if args.predict:
        print("\nGenerating predictions…")
        predictions = predict_outcomes()
        
        if not predictions.empty:
            print(f"Generated {len(predictions)} predictions")
            export_predictions(predictions)
            print("\nRisk distribution:")
            print(predictions["risk_bucket"].value_counts())
    
    if not args.train and not args.predict:
        print("Use --train to train model or --predict to generate predictions")


if __name__ == "__main__":
    main()
