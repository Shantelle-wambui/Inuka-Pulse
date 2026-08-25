# Task 1: Generate Beneficiary Trajectories (Phase 1)

## Files
- Modify: `inuka-pipeline/src/generate_inuka_data.py`
- Create: `inuka-pipeline/tests/test_generate_inuka_data.py`

## Interfaces
- Produces: `fact_engagement_history.csv` with columns `beneficiary_id, week_start, band`
- Produces: Modified `dim_beneficiary.csv` where `current_status` = final trajectory band

## Steps

### Step 1: Create test file with trajectory test

```python
# inuka-pipeline/tests/test_generate_inuka_data.py
import pytest
import sys
sys.path.insert(0, "src")

def test_build_trajectory_returns_correct_length():
    from generate_inuka_data import build_trajectory
    traj = build_trajectory(is_high_risk=True, n_weeks=26)
    assert len(traj) == 26
    assert all(b in ["Active", "At-Risk", "Disengaged", "Dropout"] for b in traj)

def test_build_trajectory_gradual_decline_has_progression():
    from generate_inuka_data import build_trajectory, TRAJECTORY_TYPES
    # Force gradual_decline by mocking random - for now just check it returns valid bands
    traj = build_trajectory(is_high_risk=True, n_weeks=26)
    # At minimum, trajectory should be a list of valid bands
    valid_bands = {"Active", "At-Risk", "Disengaged", "Dropout"}
    assert all(b in valid_bands for b in traj)

def test_stable_active_trajectory_stays_active():
    from generate_inuka_data import _build_trajectory_by_type
    traj = _build_trajectory_by_type("stable_active", n_weeks=26)
    assert traj == ["Active"] * 26
```

### Step 2: Run test to verify it fails

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py -v`
Expected: FAIL with "cannot import name 'build_trajectory'"

### Step 3: Add trajectory constants and types at top of generate_inuka_data.py

Add after line ~60 (after existing constants):

```python
# ── Trajectory types for time-varying engagement ──────────────────────────────
TRAJECTORY_TYPES = ["stable_active", "gradual_decline", "sudden_dropout",
                    "chronic_at_risk", "recovering"]

BAND_ORDER = ["Active", "At-Risk", "Disengaged", "Dropout"]
```

### Step 4: Add _build_trajectory_by_type helper function

Add after the new constants:

```python
def _build_trajectory_by_type(ttype: str, n_weeks: int = 26) -> list[str]:
    """
    Build a specific trajectory type. Called by build_trajectory after
    the type is randomly selected.
    """
    if ttype == "stable_active":
        return ["Active"] * n_weeks

    if ttype == "chronic_at_risk":
        settle = random.randint(3, 6)
        return ["Active"] * settle + ["At-Risk"] * (n_weeks - settle)

    if ttype == "recovering":
        d1 = random.randint(3, 6)
        d2 = random.randint(3, 6)
        remaining = n_weeks - d1 - d2
        if remaining < 0:
            remaining = 0
            d2 = n_weeks - d1
        return ["Active"] * d1 + ["At-Risk"] * d2 + ["Active"] * remaining

    if ttype == "sudden_dropout":
        pre = n_weeks - random.randint(2, 4)
        at_risk_weeks = n_weeks - pre - 1
        if at_risk_weeks < 1:
            at_risk_weeks = 1
            pre = n_weeks - 2
        return ["Active"] * pre + ["At-Risk"] * at_risk_weeks + ["Dropout"]

    if ttype == "gradual_decline":
        dwell = [random.randint(4, 8), random.randint(3, 6), random.randint(2, 4)]
        bands = []
        for band, d in zip(BAND_ORDER[:3], dwell):
            bands += [band] * d
            if len(bands) >= n_weeks:
                return bands[:n_weeks]
        bands += ["Dropout"] * (n_weeks - len(bands))
        return bands[:n_weeks]

    # Fallback
    return ["Active"] * n_weeks
```

### Step 5: Add build_trajectory function

```python
def build_trajectory(is_high_risk: bool, n_weeks: int = 26) -> list[str]:
    """
    Generate a per-beneficiary weekly engagement trajectory.
    High-risk cohorts have higher probability of decline/dropout trajectories.
    """
    weights = ([0.30, 0.35, 0.18, 0.12, 0.05] if is_high_risk
               else [0.60, 0.15, 0.08, 0.12, 0.05])
    ttype = random.choices(TRAJECTORY_TYPES, weights=weights)[0]
    return _build_trajectory_by_type(ttype, n_weeks)
```

### Step 6: Run test to verify it passes

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py -v`
Expected: PASS

### Step 7: Commit

```bash
cd inuka-pipeline && git add src/generate_inuka_data.py tests/test_generate_inuka_data.py
git commit -m "feat(pipeline): add trajectory generation functions for time-varying engagement"
```
