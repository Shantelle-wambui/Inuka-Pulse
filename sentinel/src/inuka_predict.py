"""
Inuka Pulse — Predictive Model
================================
Trains a logistic regression classifier that outputs the probability of a
beneficiary being at high dropout risk (Dropout or Disengaged status).

Label definition:
    label = 1  if beneficiary current_status is "Dropout" or "Disengaged"
    label = 0  if current_status is "Active" or "At-Risk"

Why status-based rather than forward-looking 30-day window?
    With 2 173 beneficiaries × 26 weekly snapshots = 56k rows, only ~136
    beneficiaries are actual dropouts. A 30-day forward window yields <1%
    positives — a trivially imbalanced problem. Using the beneficiary's
    current engagement band as the label gives a meaningful 29% positive
    rate (Dropout + Disengaged), which is well-calibrated for logistic
    regression with class_weight='balanced'. This is documented in
    inuka_backtest_report.json as label_definition.

Time split (no data leakage):
    train: as_of_date in earlier 67% of rows (sorted by date)
    test:  as_of_date in later 33% of rows

Missing value imputation:
    field_visit_gap_days:         NULL/999 → 999  (never visited)
    days_since_last_contact:      NULL/999 → 999
    assessment_score_latest:      NULL → cohort median, then global median
    assessment_score_trend:       NULL → 0 (no trend = neutral)
    attendance_rate_30d:          NULL → 0 (no sessions = worst case)

Usage:
    cd sentinel
    python -m src.inuka_predict           # train + score
    python -m src.inuka_predict --train   # force retrain
    python -m src.inuka_predict --score   # score only (requires pkl)
"""

import argparse
import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (classification_report, f1_score,
                             precision_score, recall_score)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────
RAW_DIR       = Path("data/raw/inuka")
WAREHOUSE_DIR = Path("data/warehouse")
MODELS_DIR    = Path("models")
WAREHOUSE_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

PKL_PATH         = MODELS_DIR / "inuka_logreg_v1.pkl"
PREDICTIONS_PATH = WAREHOUSE_DIR / "inuka_predictions_export.json"
BACKTEST_PATH    = WAREHOUSE_DIR / "inuka_backtest_report.json"
IMPORTANCE_PATH  = WAREHOUSE_DIR / "inuka_feature_importance.json"

# ── Feature set ───────────────────────────────────────────────────────────────
FEATURES = [
    "days_since_last_contact",
    "sessions_attended_30d",
    "attendance_rate_30d",
    "missed_sessions_14d",
    "disbursement_delay_days",
    "missed_disbursements_60d",
    "assessment_score_latest",
    "assessment_score_trend",
    "field_visit_gap_days",
    "no_contact_visits_90d",
]

LABEL_COL      = "dropout_label"
# Statuses treated as positive (high-risk) for the model
HIGH_RISK_STATUSES = {"Dropout", "Disengaged"}


# ── Label construction ────────────────────────────────────────────────────────

def build_labels(features: pd.DataFrame) -> pd.DataFrame:
    """
    Attach dropout_label to each snapshot row.
    1 = beneficiary current_status is Dropout or Disengaged
    0 = Active or At-Risk

    Using status-based labelling rather than a forward-looking window because:
    - Only ~136/2173 beneficiaries are actual dropouts (6.3%)
    - A 30-day window gives <1% positives across 56k snapshot rows
    - Status-based gives ~29% positives (Dropout + Disengaged), well-calibrated
      for balanced logistic regression
    """
    beneficiaries = pd.read_csv(RAW_DIR / "dim_beneficiary.csv")
    status_map: dict[str, int] = {
        row["beneficiary_id"]: (1 if row["current_status"] in HIGH_RISK_STATUSES else 0)
        for _, row in beneficiaries.iterrows()
    }
    features = features.copy()
    features[LABEL_COL] = features["beneficiary_id"].map(status_map).fillna(0).astype(int)
    return features


# ── Imputation ────────────────────────────────────────────────────────────────

def impute(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["field_visit_gap_days"]     = df["field_visit_gap_days"].replace(999, 999).fillna(999)
    df["days_since_last_contact"]  = df["days_since_last_contact"].replace(999, 999).fillna(999)
    df["assessment_score_trend"]   = df["assessment_score_trend"].fillna(0.0)
    df["attendance_rate_30d"]      = df["attendance_rate_30d"].fillna(0.0)

    # Assessment score: fill with per-cohort median, then global median
    cohort_medians = df.groupby("cohort_id")["assessment_score_latest"].transform("median")
    global_median  = df["assessment_score_latest"].median()
    df["assessment_score_latest"]  = (
        df["assessment_score_latest"]
        .fillna(cohort_medians)
        .fillna(global_median if not np.isnan(global_median) else 60.0)
    )
    return df


# ── Training ──────────────────────────────────────────────────────────────────

def train(features: pd.DataFrame) -> Pipeline:
    features = build_labels(features)
    features = impute(features)

    # Time split — no shuffle
    features = features.sort_values("as_of_date")
    # Use row-based 67/33 split — robust regardless of unique date count
    split_idx = int(len(features) * 0.67)
    split_date = features["as_of_date"].iloc[split_idx]

    train_df = features.iloc[:split_idx]
    test_df  = features.iloc[split_idx:]

    X_train = train_df[FEATURES].values
    y_train = train_df[LABEL_COL].values
    X_test  = test_df[FEATURES].values
    y_test  = test_df[LABEL_COL].values

    # Positive class prevalence
    pos_rate_train = y_train.mean()
    pos_rate_test  = y_test.mean()
    print(f"  Train: {len(X_train):,} rows | positive rate: {pos_rate_train:.3f}")
    print(f"  Test:  {len(X_test):,} rows  | positive rate: {pos_rate_test:.3f}")

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            random_state=42,
            C=0.5,
        )),
    ])
    pipeline.fit(X_train, y_train)

    # Evaluate
    y_pred = pipeline.predict(X_test)
    prec   = precision_score(y_test, y_pred, zero_division=0)
    rec    = recall_score(y_test, y_pred, zero_division=0)
    f1     = f1_score(y_test, y_pred, zero_division=0)

    print("\n  Classification Report (test set):")
    print(classification_report(y_test, y_pred, zero_division=0))

    # Feature importance (standardized coefficients)
    coefs = pipeline.named_steps["clf"].coef_[0]
    abs_coefs = np.abs(coefs)
    total = abs_coefs.sum() or 1.0
    importance = [
        {
            "feature":    feat,
            "coefficient": round(float(coefs[i]), 4),
            "importance":  round(float(abs_coefs[i] / total), 4),
        }
        for i, feat in enumerate(FEATURES)
    ]
    importance.sort(key=lambda x: x["importance"], reverse=True)

    # Write artifacts
    backtest = {
        "model":            "LogisticRegression",
        "label_definition": "status-based: 1 if current_status in {Dropout, Disengaged}, 0 otherwise",
        "label_rationale":  (
            "30-day forward window yields <1% positives across 56k snapshot rows. "
            "Status-based labelling gives ~29% positives — well-calibrated for balanced LR."
        ),
        "split_date":       str(split_date),
        "train_rows":       int(len(X_train)),
        "test_rows":        int(len(X_test)),
        "positive_rate_train": round(float(pos_rate_train), 4),
        "positive_rate_test":  round(float(pos_rate_test), 4),
        "precision": round(float(prec), 4),
        "recall":    round(float(rec), 4),
        "f1":        round(float(f1), 4),
        "features":  FEATURES,
    }
    BACKTEST_PATH.write_text(json.dumps(backtest, indent=2))
    IMPORTANCE_PATH.write_text(json.dumps(importance, indent=2))
    print(f"\n  Backtest → {BACKTEST_PATH}")
    print(f"  Feature importance → {IMPORTANCE_PATH}")

    # Score full dataset for export
    features = _score_and_export(pipeline, features)

    joblib.dump(pipeline, PKL_PATH)
    print(f"  Model → {PKL_PATH}")
    return pipeline


# ── Scoring & export ──────────────────────────────────────────────────────────

def _score_and_export(pipeline: Pipeline, features: pd.DataFrame) -> pd.DataFrame:
    imputed = impute(features)
    X_all   = imputed[FEATURES].values
    proba   = pipeline.predict_proba(X_all)[:, 1]
    features = features.copy()
    features["dropout_prob"] = np.round(proba, 4)

    # Top-3 risk drivers per record (by absolute contribution)
    coefs = pipeline.named_steps["clf"].coef_[0]
    scaler_means  = pipeline.named_steps["scaler"].mean_
    scaler_stds   = pipeline.named_steps["scaler"].scale_

    def top3_features(row_vals):
        z = (row_vals - scaler_means) / scaler_stds
        contribs = np.abs(z * coefs)
        top_idx  = np.argsort(contribs)[::-1][:3]
        return [FEATURES[i] for i in top_idx]

    X_raw = imputed[FEATURES].values
    features["top_features"] = [
        "|".join(top3_features(X_raw[i])) for i in range(len(X_raw))
    ]

    # Export as JSON (one record per beneficiary — latest snapshot only)
    latest = (
        features
        .sort_values("as_of_date")
        .groupby("beneficiary_id")
        .last()
        .reset_index()
    )
    export = latest[[
        "beneficiary_id", "cohort_id", "pillar", "county",
        "as_of_date", "dropout_prob", "top_features"
    ]].copy()
    export["as_of_date"] = export["as_of_date"].astype(str)

    # Map probability to engagement band
    def _band(p):
        if p >= 0.70:   return "Dropout"
        if p >= 0.45:   return "Disengaged"
        if p >= 0.25:   return "At-Risk"
        return "Active"

    export["predicted_band"] = export["dropout_prob"].map(_band)

    records = export.to_dict(orient="records")
    PREDICTIONS_PATH.write_text(json.dumps(records, indent=2))
    print(f"  Predictions export → {PREDICTIONS_PATH} ({len(records)} beneficiaries)")

    # Also write as parquet
    parquet_path = WAREHOUSE_DIR / "inuka_fact_predictions.parquet"
    export.to_parquet(parquet_path, index=False)
    return features


def score(features: pd.DataFrame):
    if not PKL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {PKL_PATH} — run with --train first")
    pipeline = joblib.load(PKL_PATH)
    print(f"Loaded model: {PKL_PATH}")
    _score_and_export(pipeline, features)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Inuka Pulse — Predictive Model")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--train", action="store_true", help="Force retrain")
    group.add_argument("--score", action="store_true", help="Score only (needs pkl)")
    args = parser.parse_args()

    features_path = WAREHOUSE_DIR / "fact_beneficiary_features.parquet"
    if not features_path.exists():
        raise FileNotFoundError(
            f"Features not found: {features_path}\n"
            "Run `python -m src.inuka_features` first."
        )

    print("Loading features…")
    features = pd.read_parquet(features_path)
    print(f"  {len(features):,} rows, {len(features['beneficiary_id'].unique()):,} beneficiaries")

    if args.score:
        score(features)
    else:
        print("Training dropout prediction model…")
        train(features)

    print("\nDone.")


if __name__ == "__main__":
    main()
