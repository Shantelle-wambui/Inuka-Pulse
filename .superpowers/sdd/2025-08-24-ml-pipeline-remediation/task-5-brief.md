# Task 5: Scale Dataset (Phase 1.5)

## Files
- Modify: `inuka-pipeline/src/generate_inuka_data.py`
- Modify: `inuka-pipeline/src/inuka_features.py`

## Interfaces
- Produces: ~6,000 beneficiaries (was ~2,000)
- Produces: 52-week window (was 26 weeks)

## Steps

### Step 1: Update beneficiary count per cohort

In `generate_inuka_data.py`, find `build_beneficiaries()` and locate the line that sets beneficiary count per cohort:

```python
# OLD (approximately):
n = random.randint(70, 110) if is_high_risk else random.randint(90, 130)

# NEW:
n = random.randint(220, 320) if is_high_risk else random.randint(260, 380)
```

### Step 2: Extend simulation window to 12 months

In `generate_inuka_data.py`, find the START constant (near the top):

```python
# OLD:
START = TODAY - timedelta(days=180)   # 6-month window

# NEW:
START = TODAY - timedelta(days=364)   # 12-month window (~52 weeks)
```

### Step 3: Update trajectory length default

Update `build_trajectory` function signature:

```python
def build_trajectory(is_high_risk: bool, n_weeks: int = 52) -> list[str]:
```

Also update `_build_trajectory_by_type` default:

```python
def _build_trajectory_by_type(ttype: str, n_weeks: int = 52) -> list[str]:
```

And adjust dwell times in `_build_trajectory_by_type` for 52 weeks — the gradual_decline type especially needs longer dwell periods:

```python
if ttype == "gradual_decline":
    dwell = [random.randint(8, 16), random.randint(6, 12), random.randint(4, 8)]
    # ... rest unchanged
```

### Step 4: Update inuka_features.py window

In `inuka_features.py`, find `build_features()`:

```python
# OLD:
def build_features(days_back: int = 180) -> pd.DataFrame:

# NEW:
def build_features(days_back: int = 364) -> pd.DataFrame:
```

### Step 5: Update test to expect 52 weeks

In `tests/test_generate_inuka_data.py`, update the trajectory length assertions:

```python
# In test_build_trajectory_returns_correct_length:
# OLD: assert len(traj) == 26
# NEW: assert len(traj) == 52

# In test_build_beneficiaries_includes_trajectory:
# OLD: assert len(ben["trajectory"]) == 26
# NEW: assert len(ben["trajectory"]) == 52

# In test_build_engagement_history_creates_weekly_records:
# OLD: assert len(ben_records) == 26
# NEW: assert len(ben_records) == 52
```

### Step 6: Run tests

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py -v`
Expected: All tests pass with updated 52-week expectations

### Step 7: Regenerate data and verify scale

Run: `cd inuka-pipeline && python -m src.generate_inuka_data && wc -l data/raw/inuka/dim_beneficiary.csv`
Expected: ~6,000+ rows (including header)

Run: `wc -l data/raw/inuka/fact_engagement_history.csv`
Expected: ~300,000+ rows (6000 beneficiaries × 52 weeks)

### Step 8: Commit

```bash
git add src/generate_inuka_data.py src/inuka_features.py tests/test_generate_inuka_data.py
git commit -m "feat(pipeline): scale dataset to 6000+ beneficiaries and 52-week window"
```
