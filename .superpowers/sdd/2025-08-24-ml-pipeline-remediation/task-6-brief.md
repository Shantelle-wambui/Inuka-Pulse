# Task 6: Add band_now Feature (Phase 2, Part 1)

## Files
- Modify: `inuka-pipeline/src/inuka_features.py`
- Create: `inuka-pipeline/tests/test_inuka_features.py`

## Interfaces
- Consumes: `data/raw/inuka/fact_engagement_history.csv`
- Produces: Features DataFrame with new `band_now` column (added to the feature set)

## Steps

### Step 1: Add test for band_now feature

Create `inuka-pipeline/tests/test_inuka_features.py`:

```python
import pytest
import pandas as pd
from pathlib import Path

def test_features_include_band_now():
    """Features should include band_now from engagement history."""
    import sys
    sys.path.insert(0, "src")
    from inuka_features import build_features
    
    features = build_features(days_back=364)
    assert "band_now" in features.columns
    valid_bands = {"Active", "At-Risk", "Disengaged", "Dropout"}
    assert features["band_now"].dropna().isin(valid_bands).all()
```

### Step 2: Run test to verify it fails

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_features.py -v`
Expected: FAIL with "KeyError" or "not in columns"

### Step 3: Load engagement history in build_features

At the start of `build_features()`, after loading other raw tables, add:

```python
# Load engagement history for band_now lookup
history_path = RAW_DIR / "fact_engagement_history.csv"
if history_path.exists():
    engagement_history = pd.read_csv(history_path)
    engagement_history["week_start"] = pd.to_datetime(engagement_history["week_start"])
else:
    engagement_history = None
```

### Step 4: Add band_now lookup in the feature building loop

The feature building creates snapshot rows for each (beneficiary, week). You need to add `band_now` to each row.

Find where the row dict is being built for each snapshot. Add the band_now lookup:

```python
# Lookup band_now from engagement history
band_now = None
if engagement_history is not None:
    as_of_dt = pd.to_datetime(as_of_date)
    # Find the matching or closest week
    ben_history = engagement_history[engagement_history["beneficiary_id"] == ben_id]
    if not ben_history.empty:
        # Find exact match or closest week before as_of_date
        matches = ben_history[ben_history["week_start"] <= as_of_dt]
        if not matches.empty:
            closest = matches.loc[matches["week_start"].idxmax()]
            band_now = closest["band"]
        else:
            # If no week before, take the earliest
            band_now = ben_history.loc[ben_history["week_start"].idxmin(), "band"]

row["band_now"] = band_now
```

Note: The exact integration depends on how build_features() is structured. Read the function and adapt the lookup to fit where rows are constructed.

### Step 5: Run test to verify it passes

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_features.py -v`
Expected: PASS

### Step 6: Rebuild features and verify

Run: `cd inuka-pipeline && python -m src.inuka_features`
Then verify:
```bash
python3 -c "import pandas as pd; df=pd.read_parquet('data/warehouse/fact_beneficiary_features.parquet'); print('band_now' in df.columns, df['band_now'].value_counts())"
```
Expected: True, with counts for Active, At-Risk, Disengaged, Dropout

### Step 7: Commit

```bash
git add src/inuka_features.py tests/test_inuka_features.py
git commit -m "feat(pipeline): add band_now feature from engagement history"
```
