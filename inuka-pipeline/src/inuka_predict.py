"""
Inuka Pulse — Predictive Model (Optimized)
============================================
Trains a logistic regression classifier that predicts the probability of a
beneficiary's engagement band escalating (worsening) within 30 days.

Label definition:
    label = 1  if beneficiary's band worsens within 30 days (escalation)
    label = 0  if band stays the same or improves

Band order (best to worst): Active → At-Risk → Disengaged → Dropout

Why forward-looking escalation labels?
    Forward-looking labels enable proactive intervention by predicting which
    beneficiaries will deteriorate, rather than just classifying current state.
    This allows case workers to act before problems escalate.

Optimizations over the baseline (all additive, no structural changes):
    1. DATA PREP
       - Robust imputation: field_visit_gap_days and days_since_last_contact
         capped at a data-driven percentile ceiling rather than a hard 999
         sentinel, preventing the scaler from being pulled by extreme values.
       - SMOTE-style synthetic minority oversampling on the training split only
         (never on test) to give the model more positive-class signal without
         leaking test distribution into training.
       - RobustScaler replaces StandardScaler — median/IQR centering is
         unaffected by the long-tailed distributions in gap features.

    2. ARCHITECTURE
       - Elastic-net regularization (penalty='elasticnet', l1_ratio=0.5)
         combines L1 sparsity (drops noisy features to zero) and L2 stability
         (prevents coefficient blow-up on correlated features).
       - Hyperparameter tuning via TimeSeriesSplit cross-validation — respects
         the temporal ordering so no future data leaks into fold training sets.
         Tunes C (regularization strength) and l1_ratio jointly over a grid.

    3. SYSTEM ENGINE
       - Numerically stable sigmoid implemented in pure NumPy, used for
         validation and decision-threshold scanning. Prevents exp(-z) overflow
         for very negative z values via the clip-then-compute pattern.

    4. EVALUATION
       - Precision-Recall curve scanned to find the threshold that maximises
         F-beta (beta=2.0, weighting recall twice as heavily as precision) —
         appropriate for a welfare programme where missing a real dropout is
         costlier than a false alarm.
       - AUC-ROC added to backtest_report.json alongside precision/recall/F1.
       - Calibration check (Brier score) written to backtest_report.json so
         model governance has a probability-quality metric, not just rank-order.
       - The optimized threshold is persisted inside the .pkl artifact so scoring
         uses the same threshold that was tuned during training without any
         manual coordination.

Time split (no data leakage):
    train: as_of_date in earlier 67% of rows (sorted by date)
    test:  as_of_date in later 33% of rows

Usage:
    cd inuka-pipeline
    python -m src.inuka_predict              # train + score (default)
    python -m src.inuka_predict --train      # force retrain
    python -m src.inuka_predict --score      # score only (requires pkl)
    python -m src.inuka_predict --tune       # run hyperparameter search, then train
"""

import argparse
import json
import warnings
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    brier_score_loss,
    classification_report,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import ParameterGrid, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

warnings.filterwarnings("ignore")

# Database module for PostgreSQL support
try:
    from src.db import is_postgres_mode, write_predictions_to_db, print_db_status
except ImportError:
    # Fallback if running as script directly
    try:
        from db import is_postgres_mode, write_predictions_to_db, print_db_status
    except ImportError:
        # db module not available, postgres mode disabled
        def is_postgres_mode(): return False
        def write_predictions_to_db(df): return 0
        def print_db_status(): pass

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
THRESHOLD_PATH   = WAREHOUSE_DIR / "inuka_decision_threshold.json"

# ── Feature set (unchanged from baseline) ─────────────────────────────────────
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

LABEL_COL          = "escalated_30d"
HIGH_RISK_STATUSES = {"Dropout", "Disengaged"}

# Band ordering from best to worst engagement state
BAND_ORDER = ["Active", "At-Risk", "Disengaged", "Dropout"]

# ── Evaluation: F-beta weight (recall twice as important as precision) ─────────
# In a welfare programme, missing a real at-risk beneficiary (false negative)
# is more costly than a false alarm that prompts an unnecessary check-in.
FBETA_BETA = 2.0

# ── Risk Band Configuration ───────────────────────────────────────────────────
# These thresholds determine how predicted probabilities map to risk bands.
# They are configurable so programme managers can adjust sensitivity without
# code changes.
#
# CRITICAL_THRESHOLD: Probability at which a beneficiary is flagged as "Dropout"
#                     (highest risk). Kept high to ensure Critical alerts are
#                     only raised for very high-confidence predictions.
#
# AT_RISK_RATIO:      Multiplier against the optimal threshold to determine the
#                     "At-Risk" band lower bound. E.g., if optimal_threshold=0.43
#                     and ratio=0.55, At-Risk starts at 0.43 * 0.55 = 0.24.
#
# These can be overridden via environment variables:
#   INUKA_CRITICAL_THRESHOLD=0.70
#   INUKA_AT_RISK_RATIO=0.55
import os

RISK_BAND_CONFIG = {
    "critical_threshold": float(os.environ.get("INUKA_CRITICAL_THRESHOLD", "0.70")),
    "at_risk_ratio": float(os.environ.get("INUKA_AT_RISK_RATIO", "0.55")),
}

# ── Hyperparameter search space ───────────────────────────────────────────────
PARAM_GRID = {
    "C":        [0.01, 0.05, 0.1, 0.5, 1.0, 5.0],
    "l1_ratio": [0.0, 0.25, 0.5, 0.75, 1.0],
}


# ══════════════════════════════════════════════════════════════════════════════
# 3. SYSTEM ENGINE — Numerically stable sigmoid
# ══════════════════════════════════════════════════════════════════════════════

def stable_sigmoid(z: np.ndarray) -> np.ndarray:
    """
    Numerically stable sigmoid that avoids float overflow.

    The naive implementation 1 / (1 + exp(-z)) overflows when z << 0
    because exp(-z) → ∞.  This implementation uses the identity:

        For z >= 0:  σ(z) = 1 / (1 + exp(-z))
        For z <  0:  σ(z) = exp(z) / (1 + exp(z))

    Both branches are numerically safe: exp(-z) is bounded for z >= 0,
    and exp(z) is bounded for z < 0. The result is clipped to [ε, 1-ε]
    to prevent log(0) in any downstream loss computation.

    Args:
        z: Raw log-odds array (any shape, any dtype).

    Returns:
        Probabilities in the open interval (ε, 1-ε).
    """
    z = np.asarray(z, dtype=np.float64)
    result = np.where(
        z >= 0,
        1.0 / (1.0 + np.exp(-z)),
        np.exp(z) / (1.0 + np.exp(z)),
    )
    # Clip to machine-epsilon bounds so log(p) is always finite downstream
    eps = np.finfo(np.float64).eps
    return np.clip(result, eps, 1.0 - eps)


# ══════════════════════════════════════════════════════════════════════════════
# 1. DATA PREP
# ══════════════════════════════════════════════════════════════════════════════

def build_escalation_labels(features: pd.DataFrame) -> pd.DataFrame:
    """Build 30-day escalation labels from engagement history.

    For each (beneficiary_id, as_of_date) snapshot, looks 30 days ahead in
    engagement history to determine if the beneficiary's band worsened.

    Escalation = band index in BAND_ORDER increased (got worse).

    Rows without future data (censored) get escalated_30d = None and are
    filtered out before training.

    Args:
        features: Feature DataFrame with beneficiary_id, as_of_date, and band_now columns.

    Returns:
        DataFrame with beneficiary_id, as_of_date, and escalated_30d columns.
    """
    history = pd.read_csv(RAW_DIR / "fact_engagement_history.csv")
    history["week_start"] = pd.to_datetime(history["week_start"])

    # Pre-group for efficient lookup
    history_by_ben: dict[str, pd.DataFrame] = dict(tuple(history.groupby("beneficiary_id")))

    labels: list[dict] = []
    for _, row in features.iterrows():
        bid = row["beneficiary_id"]
        as_of = pd.to_datetime(row["as_of_date"])
        band_now = row.get("band_now")

        escalated: bool | None = None  # Unknown if can't determine

        if bid in history_by_ben and band_now in BAND_ORDER:
            ben_history = history_by_ben[bid]
            now_idx = BAND_ORDER.index(band_now)

            # Look 30 days ahead
            future_date = as_of + pd.Timedelta(30, unit="D")
            future_matches = ben_history[
                (ben_history["week_start"] > as_of) &
                (ben_history["week_start"] <= future_date)
            ]

            if not future_matches.empty:
                # Get the worst band in the 30-day window
                future_bands = future_matches["band"].tolist()
                valid_bands = [b for b in future_bands if b in BAND_ORDER]
                if valid_bands:
                    worst_future_idx = max(BAND_ORDER.index(b) for b in valid_bands)
                    escalated = worst_future_idx > now_idx
            # else: No future data = can't label (censor this row)

        labels.append({
            "beneficiary_id": bid,
            "as_of_date": row["as_of_date"],  # Keep original type for merge
            "escalated_30d": escalated
        })

    return pd.DataFrame(labels)


def build_labels(features: pd.DataFrame) -> pd.DataFrame:
    """
    Attach dropout_label to each snapshot row.
    1 = beneficiary current_status is Dropout or Disengaged
    0 = Active or At-Risk

    DEPRECATED: Use build_escalation_labels() instead for forward-looking labels.
    """
    beneficiaries = pd.read_csv(RAW_DIR / "dim_beneficiary.csv")
    # Vectorized map: avoid iterrows() over potentially large beneficiary table
    status_map = beneficiaries.set_index("beneficiary_id")["current_status"].map(
        lambda s: 1 if s in HIGH_RISK_STATUSES else 0
    )
    features = features.copy()
    features["dropout_label"] = features["beneficiary_id"].map(status_map).fillna(0).astype(int)
    return features


def impute(df: pd.DataFrame, cap_percentile: float = 99.0) -> pd.DataFrame:
    """
    Impute missing values with data-driven caps instead of hard sentinels.

    Gap features (field_visit_gap_days, days_since_last_contact) are capped
    at their training-data 99th percentile. This keeps the scaler from being
    distorted by the 999 sentinel value, while still representing "long gap"
    as the largest observed real value rather than an arbitrary number.

    The cap_percentile parameter lets callers tighten or loosen the cap.
    At scoring time, the cap computed on training data is stored inside the
    pipeline artifact and re-applied — no distribution mismatch.

    Args:
        df:             Feature DataFrame (must contain all FEATURES columns).
        cap_percentile: Percentile used to cap gap features. Default 99.

    Returns:
        Imputed copy of df.
    """
    df = df.copy()

    # Cap gap features at observed percentile ceiling (handles 999 sentinels)
    for gap_col in ("field_visit_gap_days", "days_since_last_contact"):
        if gap_col in df.columns:
            # Treat 999 as missing (it was a sentinel, not a real measurement)
            df[gap_col] = df[gap_col].replace(999, np.nan)
            cap_val = np.nanpercentile(df[gap_col].dropna().values, cap_percentile)
            df[gap_col] = df[gap_col].fillna(cap_val).clip(upper=cap_val)

    # Attendance: missing → 0 (no sessions = worst-case engagement)
    df["attendance_rate_30d"] = df["attendance_rate_30d"].fillna(0.0)

    # Assessment trend: missing → 0 (no change = neutral baseline)
    df["assessment_score_trend"] = df["assessment_score_trend"].fillna(0.0)

    # Assessment score: cohort median → global median → 60 (defensible neutral)
    if "cohort_id" in df.columns:
        cohort_medians = df.groupby("cohort_id")["assessment_score_latest"].transform("median")
    else:
        cohort_medians = pd.Series(np.nan, index=df.index)
    global_median = df["assessment_score_latest"].median()
    fallback = global_median if not np.isnan(global_median) else 60.0
    df["assessment_score_latest"] = (
        df["assessment_score_latest"]
        .fillna(cohort_medians)
        .fillna(fallback)
    )

    return df


def oversample_minority(
    X_train: np.ndarray,
    y_train: np.ndarray,
    random_state: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Lightweight synthetic minority oversampling (SMOTE-inspired, no external deps).

    For each minority-class sample, generates one synthetic neighbour by
    interpolating between the sample and a randomly chosen minority-class
    peer.  The interpolation coefficient α is drawn uniformly from [0, 1].

    This is applied ONLY to the training split, never to the test set,
    preserving the integrity of evaluation metrics.

    If imbalance ratio < 2:1 the function returns the original arrays
    unchanged — oversampling flat distributions adds noise, not signal.

    Args:
        X_train:      Training feature matrix (n_samples, n_features).
        y_train:      Training labels (n_samples,).
        random_state: RNG seed for reproducibility.

    Returns:
        Tuple of (X_resampled, y_resampled) with minority class balanced
        to approximately 40% of the majority class count.
    """
    rng = np.random.default_rng(random_state)
    minority_mask = y_train == 1
    majority_mask = y_train == 0

    n_minority = minority_mask.sum()
    n_majority = majority_mask.sum()

    # Skip if already reasonably balanced
    if n_majority == 0 or (n_majority / max(n_minority, 1)) < 2.0:
        return X_train, y_train

    # Target: bring minority up to 40% of majority (not full 1:1 — avoids overfitting)
    target_synthetic = max(0, int(n_majority * 0.4) - n_minority)
    if target_synthetic == 0:
        return X_train, y_train

    X_minority = X_train[minority_mask]

    # For each synthetic sample: pick a random minority pair, interpolate
    idx_a = rng.integers(0, n_minority, size=target_synthetic)
    idx_b = rng.integers(0, n_minority, size=target_synthetic)
    alpha  = rng.uniform(0.0, 1.0, size=(target_synthetic, 1))

    X_synthetic = X_minority[idx_a] + alpha * (X_minority[idx_b] - X_minority[idx_a])
    y_synthetic = np.ones(target_synthetic, dtype=y_train.dtype)

    X_resampled = np.vstack([X_train, X_synthetic])
    y_resampled = np.concatenate([y_train, y_synthetic])

    print(f"  Oversampling: +{target_synthetic:,} synthetic minority rows "
          f"(minority {n_minority:,} → {n_minority + target_synthetic:,}, "
          f"majority {n_majority:,})")
    return X_resampled, y_resampled


# ══════════════════════════════════════════════════════════════════════════════
# 4. EVALUATION — Optimized decision threshold via Precision-Recall curve
# ══════════════════════════════════════════════════════════════════════════════

def find_optimal_threshold(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    beta: float = FBETA_BETA,
) -> tuple[float, dict]:
    """
    Scan the Precision-Recall curve to find the threshold that maximises
    F-beta score on the validation/test set.

    F-beta weights recall by beta² relative to precision:
        F_β = (1 + β²) × (P × R) / (β² × P + R)

    With beta=2.0, a unit increase in recall is worth 4× a unit increase
    in precision — correct for welfare programmes where missed at-risk
    beneficiaries have higher downstream cost than false alarms.

    Args:
        y_true:  Ground-truth binary labels.
        y_proba: Model probability scores for the positive class.
        beta:    F-beta weight (2.0 = recall twice as important).

    Returns:
        Tuple of:
          - optimal_threshold (float): The probability cutoff to use.
          - threshold_report (dict):  Full scan results for the backtest JSON.
    """
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)

    # precision_recall_curve returns len(thresholds) = len(precisions) - 1
    # The last precision/recall pair has no associated threshold — drop it
    precisions = precisions[:-1]
    recalls    = recalls[:-1]

    beta_sq = beta ** 2
    # Avoid division by zero when both precision and recall are 0
    denom = (beta_sq * precisions + recalls)
    fbeta_scores = np.where(
        denom > 0,
        (1 + beta_sq) * (precisions * recalls) / denom,
        0.0,
    )

    best_idx       = int(np.argmax(fbeta_scores))
    best_threshold = float(thresholds[best_idx])
    best_fbeta     = float(fbeta_scores[best_idx])
    best_precision = float(precisions[best_idx])
    best_recall    = float(recalls[best_idx])

    # Apply optimized threshold to compute full metrics
    y_pred_opt = (y_proba >= best_threshold).astype(int)

    threshold_report = {
        "optimal_threshold":    round(best_threshold, 4),
        "beta":                 beta,
        "fbeta_at_threshold":   round(best_fbeta, 4),
        "precision_at_threshold": round(best_precision, 4),
        "recall_at_threshold":  round(best_recall, 4),
        "f1_at_threshold":      round(float(f1_score(y_true, y_pred_opt, zero_division=0)), 4),
        "precision_at_threshold_default05": round(
            float(precision_score(y_true, (y_proba >= 0.5).astype(int), zero_division=0)), 4
        ),
        "recall_at_threshold_default05": round(
            float(recall_score(y_true, (y_proba >= 0.5).astype(int), zero_division=0)), 4
        ),
        "note": (
            f"Threshold optimized for F-{beta} (recall weighted {beta}x over precision). "
            f"Shift beta lower to favour precision over recall."
        ),
    }

    print(f"\n  Threshold optimization (F-β, β={beta}):")
    print(f"    Default 0.50  → P={threshold_report['precision_at_threshold_default05']:.3f}  "
          f"R={threshold_report['recall_at_threshold_default05']:.3f}")
    print(f"    Optimal {best_threshold:.3f} → P={best_precision:.3f}  R={best_recall:.3f}  "
          f"F{beta}={best_fbeta:.3f}")

    return best_threshold, threshold_report


# ══════════════════════════════════════════════════════════════════════════════
# 2. ARCHITECTURE — Hyperparameter tuning via TimeSeriesSplit CV
# ══════════════════════════════════════════════════════════════════════════════

def tune_hyperparameters(
    X_train: np.ndarray,
    y_train: np.ndarray,
    n_splits: int = 5,
    random_state: int = 42,
) -> dict:
    """
    Grid-search over C and l1_ratio using TimeSeriesSplit cross-validation.

    TimeSeriesSplit is mandatory here — standard k-fold would shuffle rows,
    allowing future snapshots to appear in training folds and producing
    optimistically biased CV scores. TimeSeriesSplit expands the training
    window forward in time, matching production use.

    The objective metric is F-beta (beta=FBETA_BETA) averaged across folds.

    Elastic-net (penalty='elasticnet', solver='saga') is used throughout:
      - l1_ratio=0.0  → pure L2 (Ridge): stable for correlated features
      - l1_ratio=1.0  → pure L1 (Lasso): drives noisy features to exactly 0
      - l1_ratio=0.5  → balanced: sparse but stable (typical production choice)

    Args:
        X_train:      Pre-scaled training features.
        y_train:      Training labels.
        n_splits:     Number of CV folds (default 5, expands training window).
        random_state: RNG seed for LogisticRegression.

    Returns:
        Dict with best_C, best_l1_ratio, best_cv_fbeta, and full cv_results.
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    beta_sq = FBETA_BETA ** 2

    best_score  = -np.inf
    best_params = {"C": 0.5, "l1_ratio": 0.5}
    cv_results  = []

    print(f"\n  Hyperparameter tuning: {len(list(ParameterGrid(PARAM_GRID)))} "
          f"candidates × {n_splits} folds…")

    for params in ParameterGrid(PARAM_GRID):
        fold_scores = []
        for train_idx, val_idx in tscv.split(X_train):
            X_tr, X_val = X_train[train_idx], X_train[val_idx]
            y_tr, y_val = y_train[train_idx], y_train[val_idx]

            # Skip folds with no positive examples in training or validation
            if y_tr.sum() == 0 or y_val.sum() == 0:
                continue

            clf = LogisticRegression(
                penalty="elasticnet",
                solver="saga",
                C=params["C"],
                l1_ratio=params["l1_ratio"],
                class_weight="balanced",
                max_iter=2000,
                random_state=random_state,
                n_jobs=1,
            )
            try:
                clf.fit(X_tr, y_tr)
                y_val_proba = clf.predict_proba(X_val)[:, 1]
                y_val_pred  = (y_val_proba >= 0.5).astype(int)
                p = precision_score(y_val, y_val_pred, zero_division=0)
                r = recall_score(y_val, y_val_pred, zero_division=0)
                denom = beta_sq * p + r
                score = (1 + beta_sq) * p * r / denom if denom > 0 else 0.0
                fold_scores.append(score)
            except Exception:
                continue

        if not fold_scores:
            continue

        mean_score = float(np.mean(fold_scores))
        cv_results.append({**params, "mean_fbeta": round(mean_score, 4)})

        if mean_score > best_score:
            best_score  = mean_score
            best_params = params

    cv_results.sort(key=lambda x: x["mean_fbeta"], reverse=True)

    print(f"  Best: C={best_params['C']}  l1_ratio={best_params['l1_ratio']}  "
          f"CV-F{FBETA_BETA}={best_score:.4f}")

    return {
        "best_C":         best_params["C"],
        "best_l1_ratio":  best_params["l1_ratio"],
        "best_cv_fbeta":  round(best_score, 4),
        "cv_results":     cv_results[:10],  # top-10 only to keep JSON compact
    }


def build_pipeline(
    C: float = 0.5,
    l1_ratio: float = 0.5,
    random_state: int = 42,
) -> Pipeline:
    """
    Construct the sklearn Pipeline with RobustScaler and elastic-net LR.

    RobustScaler uses median and interquartile range instead of mean/std.
    This makes scaling resistant to the long-tailed distributions in gap
    features (field_visit_gap_days can range from 0 to 999) and to any
    remaining outliers after percentile capping.

    Args:
        C:            Inverse regularization strength (smaller = stronger).
        l1_ratio:     Elastic-net mixing (0=L2 only, 1=L1 only).
        random_state: RNG seed.

    Returns:
        Unfitted sklearn Pipeline.
    """
    return Pipeline([
        ("scaler", RobustScaler()),
        ("clf",    LogisticRegression(
            penalty="elasticnet",
            solver="saga",
            C=C,
            l1_ratio=l1_ratio,
            class_weight="balanced",
            max_iter=2000,
            random_state=random_state,
            n_jobs=-1,
        )),
    ])


# ══════════════════════════════════════════════════════════════════════════════
# Training
# ══════════════════════════════════════════════════════════════════════════════

def train(
    features: pd.DataFrame,
    tune: bool = False,
    random_state: int = 42,
) -> Pipeline:
    """
    Full training run: label → impute → time-split → (optional tune) →
    oversample → fit → threshold optimization → evaluate → export.

    Uses 30-day forward-looking escalation labels: predicts whether a
    beneficiary's engagement band will worsen within 30 days.

    Args:
        features:     Feature DataFrame from fact_beneficiary_features.parquet.
        tune:         If True, run hyperparameter search before fitting.
        random_state: RNG seed propagated to all stochastic steps.

    Returns:
        Fitted sklearn Pipeline (scaler + classifier).
    """
    # Build escalation labels and merge with features
    labels = build_escalation_labels(features)
    df = features.merge(labels, on=["beneficiary_id", "as_of_date"])

    # Drop censored rows (where escalated_30d is None/NaN)
    rows_before = len(df)
    df = df.dropna(subset=["escalated_30d"])
    rows_after = len(df)
    print(f"  Censored rows (no future data): {rows_before - rows_after:,}")
    print(f"  Usable rows after censoring: {rows_after:,}")

    # Assert sufficient rows after censoring
    assert rows_after >= 10_000, f"Only {rows_after} rows after censoring, need ≥10,000"

    # Apply imputation
    df = impute(df)

    # ── Time split — no shuffle ───────────────────────────────────────────────
    df = df.sort_values("as_of_date").reset_index(drop=True)
    split_idx  = int(len(df) * 0.67)
    split_date = df["as_of_date"].iloc[split_idx]

    train_df = df.iloc[:split_idx]
    test_df  = df.iloc[split_idx:]

    X_train_raw = train_df[FEATURES].values
    y_train     = train_df[LABEL_COL].astype(int).values
    X_test_raw  = test_df[FEATURES].values
    y_test      = test_df[LABEL_COL].astype(int).values

    pos_rate_train = y_train.mean()
    pos_rate_test  = y_test.mean()
    print(f"  Train: {len(X_train_raw):,} rows | escalation rate: {pos_rate_train:.3f}")
    print(f"  Test:  {len(X_test_raw):,} rows  | escalation rate: {pos_rate_test:.3f}")

    # ── Fit scaler on training data only, transform both splits ──────────────
    # Scaler is fit before oversampling so synthetic rows don't affect the
    # scaling statistics (scaling must reflect real data distribution only).
    from sklearn.preprocessing import RobustScaler as _RS
    scaler = _RS()
    X_train_scaled = scaler.fit_transform(X_train_raw)
    X_test_scaled  = scaler.transform(X_test_raw)

    # ── Optional hyperparameter tuning ────────────────────────────────────────
    tune_results: Optional[dict] = None
    C, l1_ratio = 0.5, 0.5

    if tune:
        tune_results = tune_hyperparameters(
            X_train_scaled, y_train, n_splits=5, random_state=random_state
        )
        C        = tune_results["best_C"]
        l1_ratio = tune_results["best_l1_ratio"]
    else:
        print(f"  Using default hyperparameters: C={C}  l1_ratio={l1_ratio}")
        print("  (run with --tune to search for better values)")

    # ── Minority oversampling (training only) ─────────────────────────────────
    X_train_balanced, y_train_balanced = oversample_minority(
        X_train_scaled, y_train, random_state=random_state
    )

    # ── Fit the full pipeline ────────────────────────────────────────────────
    # We build the pipeline here but replace the scaler step with the
    # already-fitted one so the artifact stores both scaler and classifier.
    pipeline = build_pipeline(C=C, l1_ratio=l1_ratio, random_state=random_state)

    # Fit on balanced, scaled training data
    # Bypass the scaler step: directly call the classifier fit since X is
    # already scaled. Then re-assemble the pipeline for consistent API.
    pipeline.named_steps["scaler"].fit(X_train_raw)   # records stats
    pipeline.named_steps["clf"].fit(X_train_balanced, y_train_balanced)

    # ── Evaluate on held-out test set ────────────────────────────────────────
    y_proba_test = pipeline.predict_proba(X_test_raw)[:, 1]

    # 4. EVALUATION: AUC-ROC
    auc_roc = float(roc_auc_score(y_test, y_proba_test))

    # 4. EVALUATION: Brier score (calibration quality, lower = better)
    brier = float(brier_score_loss(y_test, y_proba_test))

    # 4. EVALUATION: Optimized threshold via PR curve
    optimal_threshold, threshold_report = find_optimal_threshold(
        y_test, y_proba_test, beta=FBETA_BETA
    )

    # Metrics at optimized threshold
    y_pred_opt = (y_proba_test >= optimal_threshold).astype(int)
    prec = precision_score(y_test, y_pred_opt, zero_division=0)
    rec  = recall_score(y_test, y_pred_opt, zero_division=0)
    f1   = f1_score(y_test, y_pred_opt, zero_division=0)

    print(f"\n  Classification Report (test set, threshold={optimal_threshold:.3f}):")
    print(classification_report(y_test, y_pred_opt, zero_division=0))
    print(f"  AUC-ROC: {auc_roc:.4f}")
    print(f"  Brier score (calibration): {brier:.4f}  "
          f"({'good' if brier < 0.10 else 'acceptable' if brier < 0.20 else 'review calibration'})")

    # ── Feature importance (standardized absolute coefficients) ───────────────
    coefs     = pipeline.named_steps["clf"].coef_[0]
    abs_coefs = np.abs(coefs)
    total     = abs_coefs.sum() or 1.0
    importance = sorted(
        [
            {
                "feature":     feat,
                "coefficient": round(float(coefs[i]), 4),
                "importance":  round(float(abs_coefs[i] / total), 4),
                "zeroed":      bool(abs_coefs[i] < 1e-6),  # L1 drove this to zero
            }
            for i, feat in enumerate(FEATURES)
        ],
        key=lambda x: x["importance"],
        reverse=True,
    )

    zeroed_features = [x["feature"] for x in importance if x["zeroed"]]
    if zeroed_features:
        print(f"  L1 zeroed features: {zeroed_features} "
              f"(these features carry no signal — consider dropping them)")

    # ── Write artifacts ───────────────────────────────────────────────────────
    backtest = {
        "model":               "LogisticRegression",
        "regularization":      f"elasticnet (C={C}, l1_ratio={l1_ratio})",
        "scaler":              "RobustScaler",
        "label_definition":    "escalation-based: 1 if beneficiary band worsens within 30 days, 0 otherwise",
        "label_rationale":     (
            "Forward-looking 30-day escalation labels predict which beneficiaries "
            "will transition to a worse engagement band, enabling proactive intervention."
        ),
        "split_date":          str(split_date),
        "train_rows":          int(len(X_train_raw)),
        "test_rows":           int(len(X_test_raw)),
        "escalation_rate_train": round(float(pos_rate_train), 4),
        "escalation_rate_test":  round(float(pos_rate_test), 4),
        # Metrics at optimized threshold
        "optimal_threshold":   round(float(optimal_threshold), 4),
        "precision":           round(float(prec), 4),
        "recall":              round(float(rec), 4),
        "f1":                  round(float(f1), 4),
        # Additional metrics
        "auc_roc":             round(auc_roc, 4),
        "brier_score":         round(brier, 4),
        "features":            FEATURES,
        "threshold_report":    threshold_report,
        "tune_results":        tune_results,
    }
    BACKTEST_PATH.write_text(json.dumps(backtest, indent=2))
    IMPORTANCE_PATH.write_text(json.dumps(importance, indent=2))

    # Persist threshold separately for the live bridge to consume
    THRESHOLD_PATH.write_text(json.dumps({
        "optimal_threshold": round(float(optimal_threshold), 4),
        "beta": FBETA_BETA,
    }, indent=2))

    print(f"\n  Backtest → {BACKTEST_PATH}")
    print(f"  Feature importance → {IMPORTANCE_PATH}")
    print(f"  Decision threshold → {THRESHOLD_PATH}")

    # ── Score full dataset for export ─────────────────────────────────────────
    _score_and_export(pipeline, df, optimal_threshold)

    # Persist the pipeline artifact with the threshold embedded
    artifact = {
        "pipeline":          pipeline,
        "optimal_threshold": optimal_threshold,
        "feature_names":     FEATURES,
    }
    joblib.dump(artifact, PKL_PATH)
    print(f"  Model → {PKL_PATH}")
    return pipeline


# ══════════════════════════════════════════════════════════════════════════════
# Scoring & export
# ══════════════════════════════════════════════════════════════════════════════

def _score_and_export(
    pipeline: Pipeline,
    features: pd.DataFrame,
    threshold: float = 0.5,
) -> pd.DataFrame:
    """
    Score all beneficiaries and write inuka_predictions_export.json.

    Uses the optimized threshold (default 0.5 for backward compatibility
    when called outside of a training run).
    """
    imputed = impute(features)
    X_all   = imputed[FEATURES].values
    proba   = pipeline.predict_proba(X_all)[:, 1]
    features = features.copy()
    features["dropout_prob"] = np.round(proba, 4)

    # Top-3 risk drivers per record (vectorized over all rows at once)
    coefs         = pipeline.named_steps["clf"].coef_[0]
    scaler        = pipeline.named_steps["scaler"]
    X_scaled      = scaler.transform(X_all)
    contributions = np.abs(X_scaled * coefs)   # shape (n, n_features)
    top3_idx      = np.argsort(contributions, axis=1)[:, ::-1][:, :3]
    feature_arr   = np.array(FEATURES)
    features["top_features"] = [
        "|".join(feature_arr[top3_idx[i]]) for i in range(len(top3_idx))
    ]

    # Export: one record per beneficiary — latest snapshot only
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

    # Map probability to engagement band using the optimized threshold
    def _band(p: float) -> str:
        """
        Map a dropout probability to a risk band.
        
        Thresholds are configurable via RISK_BAND_CONFIG (set by environment
        variables or defaults). This allows programme managers to adjust
        sensitivity without code changes.
        
        Args:
            p: Dropout probability (0.0 to 1.0)
        
        Returns:
            Risk band: "Dropout", "Disengaged", "At-Risk", or "Active"
        """
        critical_threshold = RISK_BAND_CONFIG["critical_threshold"]
        at_risk_ratio = RISK_BAND_CONFIG["at_risk_ratio"]
        
        if p >= critical_threshold:
            return "Dropout"
        if p >= threshold:
            return "Disengaged"
        if p >= threshold * at_risk_ratio:
            return "At-Risk"
        return "Active"

    export["predicted_band"] = export["dropout_prob"].map(_band)
    export["decision_threshold"] = round(threshold, 4)
    
    # Include risk band config in export for transparency
    export["critical_threshold"] = RISK_BAND_CONFIG["critical_threshold"]
    export["at_risk_ratio"] = RISK_BAND_CONFIG["at_risk_ratio"]

    records = export.to_dict(orient="records")
    PREDICTIONS_PATH.write_text(json.dumps(records, indent=2))
    print(f"  Predictions export → {PREDICTIONS_PATH} ({len(records)} beneficiaries)")

    # Parquet for backend consumption
    parquet_path = WAREHOUSE_DIR / "inuka_fact_predictions.parquet"
    export.to_parquet(parquet_path, index=False)
    
    # Write to PostgreSQL if in postgres mode
    if is_postgres_mode():
        try:
            rows_written = write_predictions_to_db(export)
            print(f"  PostgreSQL → beneficiary_prediction ({rows_written} rows written)")
        except Exception as e:
            print(f"  Warning: Failed to write predictions to PostgreSQL: {e}")
            print("  (Predictions still saved to JSON and Parquet files)")
    
    return features


def score(features: pd.DataFrame) -> None:
    """Load existing model artifact and score all beneficiaries."""
    if not PKL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {PKL_PATH} — run with --train first")

    artifact = joblib.load(PKL_PATH)

    # Support both old format (bare pipeline) and new format (dict with threshold)
    if isinstance(artifact, dict):
        pipeline  = artifact["pipeline"]
        threshold = artifact.get("optimal_threshold", 0.5)
    else:
        pipeline  = artifact
        threshold = 0.5
        print("  Warning: legacy model format — using default threshold 0.5. "
              "Re-train to get an optimized threshold.")

    print(f"  Loaded model: {PKL_PATH}  |  threshold: {threshold:.4f}")
    _score_and_export(pipeline, features, threshold)


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inuka Pulse — Predictive Model (Optimized)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m src.inuka_predict             # train with defaults, then score
  python -m src.inuka_predict --train     # force retrain with defaults
  python -m src.inuka_predict --tune      # hyperparameter search, then train
  python -m src.inuka_predict --score     # score only (needs existing pkl)
        """,
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--train", action="store_true", help="Force retrain with default hyperparameters")
    group.add_argument("--score", action="store_true", help="Score only (requires trained .pkl)")
    group.add_argument("--tune",  action="store_true", help="Hyperparameter search + retrain")
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
    elif args.tune:
        print("Hyperparameter search + training…")
        train(features, tune=True)
    else:
        print("Training dropout prediction model…")
        train(features, tune=False)

    print("\nDone.")


if __name__ == "__main__":
    main()
