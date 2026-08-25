# Task 7: Implement Escalation Label (Phase 2, Part 2)

## Files
- Modify: `inuka-pipeline/src/inuka_predict.py`
- Modify: `inuka-pipeline/tests/test_inuka_predict.py` (create if not exists)

## Interfaces
- Consumes: `data/raw/inuka/fact_engagement_history.csv` (beneficiary_id, week_start, band)
- Consumes: Features DataFrame with `band_now` column
- Produces: Labels DataFrame with `escalated_30d` boolean column (True = band worsened within 30 days)

## Context

The current `build_labels()` in `inuka_predict.py` builds current-state classification labels (is the beneficiary currently at-risk or worse). This must be replaced with forward-looking escalation labels: "Did this beneficiary's band worsen within 30 days of the snapshot date?"

Band order (best to worst): Active → At-Risk → Disengaged → Dropout

Escalation = band at t+30 is worse than band at t (higher index in BAND_ORDER).

## Steps

### Step 1: Add BAND_ORDER constant

At the top of `inuka_predict.py`, add:

```python
BAND_ORDER = ["Active", "At-Risk", "Disengaged", "Dropout"]
```

### Step 2: Replace build_labels() with build_escalation_labels()

Create a new function that:
1. Loads `fact_engagement_history.csv`
2. For each (beneficiary_id, as_of_date) in the features, finds `band_now`
3. Looks 30 days ahead in engagement history to find `band_future`
4. Sets `escalated_30d = True` if `band_future` index > `band_now` index

```python
def build_escalation_labels(features: pd.DataFrame) -> pd.DataFrame:
    """Build 30-day escalation labels from engagement history.
    
    escalated_30d = True if beneficiary's band worsens within 30 days of snapshot.
    """
    history = pd.read_csv(RAW_DIR / "fact_engagement_history.csv")
    history["week_start"] = pd.to_datetime(history["week_start"])
    
    # Pre-group for efficient lookup
    history_by_ben = dict(tuple(history.groupby("beneficiary_id")))
    
    labels = []
    for _, row in features.iterrows():
        bid = row["beneficiary_id"]
        as_of = pd.to_datetime(row["as_of_date"])
        band_now = row.get("band_now")
        
        escalated = None  # Unknown if can't determine
        
        if bid in history_by_ben and band_now in BAND_ORDER:
            ben_history = history_by_ben[bid]
            now_idx = BAND_ORDER.index(band_now)
            
            # Look 30 days ahead
            future_date = as_of + pd.Timedelta(days=30)
            future_matches = ben_history[
                (ben_history["week_start"] > as_of) &
                (ben_history["week_start"] <= future_date)
            ]
            
            if not future_matches.empty:
                # Get the worst band in the 30-day window
                future_bands = future_matches["band"].tolist()
                worst_future_idx = max(BAND_ORDER.index(b) for b in future_bands if b in BAND_ORDER)
                escalated = worst_future_idx > now_idx
            else:
                # No future data = can't label (censor this row)
                escalated = None
        
        labels.append({
            "beneficiary_id": bid,
            "as_of_date": as_of,
            "escalated_30d": escalated
        })
    
    return pd.DataFrame(labels)
```

### Step 3: Update train_model() to use escalation labels

In `train_model()`, replace the call to `build_labels()` with:

```python
labels = build_escalation_labels(features)

# Merge and drop censored rows (where escalated_30d is None/NaN)
df = features.merge(labels, on=["beneficiary_id", "as_of_date"])
df = df.dropna(subset=["escalated_30d"])

# Assert sufficient rows after censoring
assert len(df) >= 10000, f"Only {len(df)} rows after censoring, need ≥10,000"

# Target
y = df["escalated_30d"].astype(int)
```

### Step 4: Add test for escalation labels

Create/update `tests/test_inuka_predict.py`:

```python
import pytest
import pandas as pd
import sys
sys.path.insert(0, "src")

def test_escalation_labels_produce_boolean():
    """Escalation labels should be boolean (0/1) after dropna."""
    from inuka_predict import build_escalation_labels
    from inuka_features import build_features
    
    features = build_features(days_back=60)  # Small window for speed
    labels = build_escalation_labels(features)
    
    assert "escalated_30d" in labels.columns
    # After dropping None values, should only have True/False
    valid_labels = labels.dropna(subset=["escalated_30d"])
    assert valid_labels["escalated_30d"].isin([True, False]).all()

def test_row_count_after_censoring():
    """After censoring, should have ≥10,000 usable rows with full dataset."""
    from inuka_predict import build_escalation_labels
    from inuka_features import build_features
    
    features = build_features(days_back=364)
    labels = build_escalation_labels(features)
    df = features.merge(labels, on=["beneficiary_id", "as_of_date"])
    df = df.dropna(subset=["escalated_30d"])
    
    assert len(df) >= 10000, f"Only {len(df)} rows, need ≥10,000"
```

### Step 5: Run tests

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_predict.py -v`
Expected: All tests pass

### Step 6: Verify training data scale

Run a quick verification:
```bash
cd inuka-pipeline && python3 -c "
from src.inuka_features import build_features
from src.inuka_predict import build_escalation_labels
import pandas as pd

features = build_features(days_back=364)
labels = build_escalation_labels(features)
df = features.merge(labels, on=['beneficiary_id', 'as_of_date'])
df = df.dropna(subset=['escalated_30d'])
print(f'Usable rows: {len(df)}')
print(f'Escalation rate: {df[\"escalated_30d\"].mean():.1%}')
"
```
Expected: ≥10,000 usable rows, escalation rate between 5-40%

### Step 7: Commit

```bash
git add src/inuka_predict.py tests/test_inuka_predict.py
git commit -m "feat(pipeline): implement 30-day escalation labels replacing current-state classification"
```
