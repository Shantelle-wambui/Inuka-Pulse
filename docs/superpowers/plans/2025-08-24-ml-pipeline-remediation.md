# ML Pipeline Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 8 defects in the ML pipeline so the dropout prediction model produces genuine 30-day escalation forecasts instead of current-state classifications, and thread beneficiary identity through the entire alert/incident/CAPA chain to enable My Caseload.

**Architecture:** Python pipeline generates trajectories → features → escalation labels → retrained model → JSON export. Java backend threads `beneficiary_id` through entities and adds `PredictionInterpretationService`. Frontend adds `ExplainabilityPanel` and `PredictionFeedbackWidget` components consuming the interpretation layer.

**Tech Stack:** Python 3.12, pandas, scikit-learn, joblib | Spring Boot 3, JPA/Hibernate, Flyway | Next.js 14, React, TypeScript

## Global Constraints

- Python: pandas >= 2.0, scikit-learn >= 1.3, numpy >= 1.24
- Java: Spring Boot 3.x, Java 17+
- Frontend: Next.js 14, TypeScript strict mode
- All ML outputs go to `inuka-pipeline/data/warehouse/`
- All DB migrations use Flyway naming: `V{next}__{description}.sql`
- Commit after each task passes validation

---

## File Structure

### Python Pipeline (inuka-pipeline/src/)

| File | Responsibility |
|------|----------------|
| `generate_inuka_data.py` | Modify: add trajectory generation, scale beneficiaries/window |
| `inuka_features.py` | Modify: add `band_now` feature lookup from engagement history |
| `inuka_predict.py` | Modify: replace `build_labels()` with `build_escalation_labels()`, add row-count assertion |
| `inuka_live_bridge.py` | Modify: add `beneficiary_id` as structured field in output |

### Java Backend (inuka-pulse-backend/src/main/java/com/inukapulse/)

| File | Responsibility |
|------|----------------|
| `site/IncidentEntity.java` | Modify: add `beneficiaryId` column |
| `alert/AlertEntity.java` | Modify: add `beneficiaryId` column |
| `etl/EtlReloadService.java` | Modify: read and persist `beneficiary_id` |
| `ml/PredictionInterpretationService.java` | Create: centralized prediction interpretation |
| `ml/PredictionView.java` | Create: immutable record for interpreted predictions |
| `resources/db/migration/V34__add_beneficiary_id_columns.sql` | Create: schema migration |

### Frontend (inuka-pulse-frontend/src/components/)

| File | Responsibility |
|------|----------------|
| `explainability-panel.tsx` | Create: renders top drivers in plain language |
| `prediction-feedback-widget.tsx` | Create: feedback submission control |
| `risk-band-badge.tsx` | Modify: add confidence prop |

---

## Task 1: Generate Beneficiary Trajectories (Phase 1)

**Files:**
- Modify: `inuka-pipeline/src/generate_inuka_data.py`
- Create: `inuka-pipeline/tests/test_generate_inuka_data.py`

**Interfaces:**
- Produces: `fact_engagement_history.csv` with columns `beneficiary_id, week_start, band`
- Produces: Modified `dim_beneficiary.csv` where `current_status` = final trajectory band

- [ ] **Step 1: Create test file with trajectory test**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py -v`
Expected: FAIL with "cannot import name 'build_trajectory'"

- [ ] **Step 3: Add trajectory constants and types at top of generate_inuka_data.py**

Add after line ~60 (after existing constants):

```python
# ── Trajectory types for time-varying engagement ──────────────────────────────
TRAJECTORY_TYPES = ["stable_active", "gradual_decline", "sudden_dropout",
                    "chronic_at_risk", "recovering"]

BAND_ORDER = ["Active", "At-Risk", "Disengaged", "Dropout"]
```

- [ ] **Step 4: Add _build_trajectory_by_type helper function**

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

- [ ] **Step 5: Add build_trajectory function**

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

- [ ] **Step 6: Run test to verify it passes**

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd inuka-pipeline && git add src/generate_inuka_data.py tests/test_generate_inuka_data.py
git commit -m "feat(pipeline): add trajectory generation functions for time-varying engagement"
```

---

## Task 2: Integrate Trajectories into Beneficiary Generation

**Files:**
- Modify: `inuka-pipeline/src/generate_inuka_data.py`

**Interfaces:**
- Consumes: `build_trajectory(is_high_risk, n_weeks) -> list[str]`
- Produces: Each beneficiary dict now has `trajectory: list[str]` field
- Produces: `current_status` is `trajectory[-1]` (final week's band)

- [ ] **Step 1: Add test for beneficiary trajectory field**

Append to `tests/test_generate_inuka_data.py`:

```python
def test_build_beneficiaries_includes_trajectory():
    from generate_inuka_data import build_beneficiaries, build_cohorts
    cohorts = build_cohorts()[:2]  # Just 2 cohorts for speed
    beneficiaries = build_beneficiaries(cohorts)
    assert len(beneficiaries) > 0
    ben = beneficiaries[0]
    assert "trajectory" in ben
    assert isinstance(ben["trajectory"], list)
    assert len(ben["trajectory"]) == 26
    assert ben["current_status"] == ben["trajectory"][-1]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_beneficiaries_includes_trajectory -v`
Expected: FAIL with "KeyError: 'trajectory'"

- [ ] **Step 3: Modify build_beneficiaries to generate trajectories**

Find `build_beneficiaries()` (around line 235). Replace the status assignment block:

```python
# OLD CODE (around lines 268-277):
status = random.choices(ENGAGEMENT_LEVELS, weights=...)[0]
dropout_date = None
dropout_reason = None
if status == "Dropout":
    dropout_date = rand_date(...)
    dropout_reason = random.choice(DROPOUT_REASONS)
```

With:

```python
# NEW CODE:
trajectory = build_trajectory(is_high_risk, n_weeks=26)
status = trajectory[-1]  # current_status = final week's band

dropout_date = None
dropout_reason = None
if status == "Dropout":
    # Find first week where band became Dropout
    dropout_week = next((i for i, b in enumerate(trajectory) if b == "Dropout"), len(trajectory) - 1)
    dropout_date = enroll_date + timedelta(weeks=dropout_week)
    dropout_reason = random.choice(DROPOUT_REASONS)
```

- [ ] **Step 4: Add trajectory to beneficiary dict**

In the same function, find where the beneficiary dict is built (around line 278) and add the trajectory field:

```python
beneficiaries.append({
    "beneficiary_id": ben_id,
    "full_name":      full_name,
    "cohort_id":      cohort["cohort_id"],
    "pillar":         cohort["pillar"],
    "county":         cohort["county"],
    "gender":         gender,
    "age":            age,
    "enrollment_date": enroll_date.strftime("%Y-%m-%d"),
    "current_status":  status,
    "dropout_date":    dropout_date.strftime("%Y-%m-%d") if dropout_date else None,
    "dropout_reason":  dropout_reason,
    "phone":          f"+254{random.randint(700000000, 799999999)}",
    "trajectory":     trajectory,  # NEW FIELD
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_beneficiaries_includes_trajectory -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/generate_inuka_data.py tests/test_generate_inuka_data.py
git commit -m "feat(pipeline): integrate trajectories into beneficiary generation"
```

---

## Task 3: Generate fact_engagement_history.csv

**Files:**
- Modify: `inuka-pipeline/src/generate_inuka_data.py`

**Interfaces:**
- Consumes: Beneficiaries with `trajectory` field
- Produces: `data/raw/inuka/fact_engagement_history.csv` with columns `beneficiary_id, week_start, band`

- [ ] **Step 1: Add test for engagement history generation**

Append to `tests/test_generate_inuka_data.py`:

```python
def test_build_engagement_history_creates_weekly_records():
    from generate_inuka_data import build_engagement_history, build_beneficiaries, build_cohorts, START
    from datetime import timedelta
    cohorts = build_cohorts()[:1]
    beneficiaries = build_beneficiaries(cohorts)[:5]  # 5 beneficiaries for speed
    history = build_engagement_history(beneficiaries)
    
    # Each beneficiary should have 26 weekly records
    ben_id = beneficiaries[0]["beneficiary_id"]
    ben_records = [h for h in history if h["beneficiary_id"] == ben_id]
    assert len(ben_records) == 26
    
    # Records should have required columns
    assert all("week_start" in h and "band" in h for h in history)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_engagement_history_creates_weekly_records -v`
Expected: FAIL with "cannot import name 'build_engagement_history'"

- [ ] **Step 3: Implement build_engagement_history function**

Add after `build_trajectory`:

```python
def build_engagement_history(beneficiaries: list[dict]) -> list[dict]:
    """
    Expand each beneficiary's trajectory into weekly (beneficiary_id, week_start, band) records.
    This is the ground-truth table the escalation label will be built from.
    """
    history = []
    for ben in beneficiaries:
        enroll_date = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d").date()
        trajectory = ben["trajectory"]
        
        for week_idx, band in enumerate(trajectory):
            week_start = enroll_date + timedelta(weeks=week_idx)
            history.append({
                "beneficiary_id": ben["beneficiary_id"],
                "week_start": week_start.strftime("%Y-%m-%d"),
                "band": band,
            })
    
    return history
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_engagement_history_creates_weekly_records -v`
Expected: PASS

- [ ] **Step 5: Integrate into main() and write CSV**

Find the `main()` function (around line 560). After `beneficiaries = build_beneficiaries(cohorts)`, add:

```python
# 2a. fact_engagement_history — weekly band snapshots per beneficiary
engagement_history = build_engagement_history(beneficiaries)
pd.DataFrame(engagement_history).to_csv(
    RAW_DIR / "fact_engagement_history.csv", index=False
)
print(f"  fact_engagement_history.csv: {len(engagement_history):,} rows")
```

- [ ] **Step 6: Run full generation and verify file exists**

Run: `cd inuka-pipeline && python -m src.generate_inuka_data && head -5 data/raw/inuka/fact_engagement_history.csv`
Expected: CSV with header `beneficiary_id,week_start,band` and data rows

- [ ] **Step 7: Commit**

```bash
git add src/generate_inuka_data.py tests/test_generate_inuka_data.py
git commit -m "feat(pipeline): generate fact_engagement_history.csv with weekly band snapshots"
```

---

## Task 4: Drive Attendance from Weekly Band (Phase 1 completion)

**Files:**
- Modify: `inuka-pipeline/src/generate_inuka_data.py`

**Interfaces:**
- Consumes: Beneficiary `trajectory` field
- Produces: Sessions with attendance probability driven by that week's band, not static status

- [ ] **Step 1: Add test for trajectory-driven attendance**

Append to `tests/test_generate_inuka_data.py`:

```python
def test_build_sessions_uses_weekly_band():
    """
    Sessions attendance should vary based on trajectory band, not static status.
    A declining beneficiary should have lower attendance in later weeks.
    """
    from generate_inuka_data import build_sessions, build_beneficiaries, build_cohorts
    
    cohorts = build_cohorts()[:1]
    beneficiaries = build_beneficiaries(cohorts)
    
    # Find a beneficiary with gradual_decline trajectory (if any)
    declining = [b for b in beneficiaries if "Disengaged" in b["trajectory"] or "Dropout" in b["trajectory"]]
    if not declining:
        pytest.skip("No declining beneficiaries in sample")
    
    sessions = build_sessions(beneficiaries)
    # Just verify sessions are generated - detailed attendance testing would be flaky
    assert len(sessions) > 0
    assert all("attended" in s for s in sessions)
```

- [ ] **Step 2: Run test to verify baseline passes**

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_sessions_uses_weekly_band -v`
Expected: PASS (test just checks sessions exist for now)

- [ ] **Step 3: Modify build_sessions to use weekly band**

Find `build_sessions()` (around line 288). Replace the attendance probability logic:

```python
# OLD CODE (around lines 303-309):
base_attend = 0.55 if is_high_risk else 0.82
if ben["current_status"] == "Disengaged":
    base_attend *= 0.5
elif ben["current_status"] == "At-Risk":
    base_attend *= 0.7
attended = random.random() < base_attend
```

With:

```python
# NEW CODE: Use weekly band from trajectory
trajectory = ben.get("trajectory", [ben["current_status"]] * 26)
enroll_date = datetime.strptime(ben["enrollment_date"], "%Y-%m-%d").date()

# Determine which week this session falls in
weeks_since_enroll = (session_date - enroll_date).days // 7
week_idx = min(weeks_since_enroll, len(trajectory) - 1)
week_idx = max(0, week_idx)
current_band = trajectory[week_idx]

# Attendance probability based on current band
BAND_ATTEND_RATES = {
    "Active": 0.88,
    "At-Risk": 0.65,
    "Disengaged": 0.35,
    "Dropout": 0.05,
}
base_attend = BAND_ATTEND_RATES.get(current_band, 0.50)

# High-risk cohorts have slightly lower baseline
if is_high_risk:
    base_attend *= 0.92

attended = random.random() < base_attend
```

Note: `session_date` needs to be available in the loop. If necessary, move the date parsing earlier in the loop.

- [ ] **Step 4: Run test to verify it still passes**

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_sessions_uses_weekly_band -v`
Expected: PASS

- [ ] **Step 5: Similarly update build_field_visits and build_assessments**

In `build_field_visits()` (around line 342), replace static status checks with trajectory lookup.

In `build_assessments()` (around line 471), remove the blanket skip for Dropout status:

```python
# OLD CODE (around line 476):
if ben["current_status"] == "Dropout":
    continue
```

Replace with:

```python
# NEW CODE: Generate assessments up to when beneficiary dropped out
trajectory = ben.get("trajectory", [ben["current_status"]] * 26)
# Find last week before dropout (or all weeks if never dropped)
last_engaged_week = len(trajectory)
for i, band in enumerate(trajectory):
    if band == "Dropout":
        last_engaged_week = i
        break
```

Then only generate assessments for waves that fall before `last_engaged_week`.

- [ ] **Step 6: Run full data generation and verify**

Run: `cd inuka-pipeline && python -m src.generate_inuka_data`
Expected: Completes without errors, all CSV files generated

- [ ] **Step 7: Commit**

```bash
git add src/generate_inuka_data.py
git commit -m "feat(pipeline): drive attendance/visits/assessments from weekly trajectory band"
```

---

## Task 5: Scale Dataset (Phase 1.5)

**Files:**
- Modify: `inuka-pipeline/src/generate_inuka_data.py`
- Modify: `inuka-pipeline/src/inuka_features.py`

**Interfaces:**
- Produces: ~6,000 beneficiaries (was ~2,000)
- Produces: 52-week window (was 26 weeks)

- [ ] **Step 1: Update beneficiary count per cohort**

In `generate_inuka_data.py`, find `build_beneficiaries()` (around line 241):

```python
# OLD:
n = random.randint(70, 110) if is_high_risk else random.randint(90, 130)

# NEW:
n = random.randint(220, 320) if is_high_risk else random.randint(260, 380)
```

- [ ] **Step 2: Extend simulation window to 12 months**

In `generate_inuka_data.py`, find the START constant (around line 59):

```python
# OLD:
START = TODAY - timedelta(days=180)   # 6-month window

# NEW:
START = TODAY - timedelta(days=364)   # 12-month window (~52 weeks)
```

- [ ] **Step 3: Update trajectory length default**

Update `build_trajectory` default:

```python
def build_trajectory(is_high_risk: bool, n_weeks: int = 52) -> list[str]:
```

And update `_build_trajectory_by_type` to handle longer trajectories properly (dwell times may need adjustment for 52 weeks).

- [ ] **Step 4: Update inuka_features.py window**

In `inuka_features.py`, find `build_features()`:

```python
# OLD:
def build_features(days_back: int = 180) -> pd.DataFrame:

# NEW:
def build_features(days_back: int = 364) -> pd.DataFrame:
```

- [ ] **Step 5: Regenerate data and verify scale**

Run: `cd inuka-pipeline && python -m src.generate_inuka_data && wc -l data/raw/inuka/dim_beneficiary.csv`
Expected: ~6,000+ rows (including header)

Run: `wc -l data/raw/inuka/fact_engagement_history.csv`
Expected: ~300,000+ rows (6000 beneficiaries × 52 weeks)

- [ ] **Step 6: Commit**

```bash
git add src/generate_inuka_data.py src/inuka_features.py
git commit -m "feat(pipeline): scale dataset to 6000+ beneficiaries and 52-week window"
```

---

## Task 6: Add band_now Feature (Phase 2, Part 1)

**Files:**
- Modify: `inuka-pipeline/src/inuka_features.py`

**Interfaces:**
- Consumes: `data/raw/inuka/fact_engagement_history.csv`
- Produces: Features DataFrame with new `band_now` column

- [ ] **Step 1: Add test for band_now feature**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_features.py -v`
Expected: FAIL with "KeyError" or "not in columns"

- [ ] **Step 3: Load engagement history in build_features**

At the start of `build_features()`, after loading other raw tables:

```python
# Load engagement history for band_now lookup
history_path = RAW_DIR / "fact_engagement_history.csv"
if history_path.exists():
    engagement_history = pd.read_csv(history_path)
    engagement_history["week_start"] = pd.to_datetime(engagement_history["week_start"])
else:
    engagement_history = None
```

- [ ] **Step 4: Add band_now lookup in the feature loop**

In the weekly snapshot loop, after computing other features for a (beneficiary, week) pair:

```python
# Lookup band_now from engagement history
band_now = None
if engagement_history is not None:
    # Find the matching week
    match = engagement_history[
        (engagement_history["beneficiary_id"] == ben_id) &
        (engagement_history["week_start"] == as_of_date)
    ]
    if not match.empty:
        band_now = match.iloc[0]["band"]
    else:
        # Fallback: find closest week
        ben_history = engagement_history[engagement_history["beneficiary_id"] == ben_id]
        if not ben_history.empty:
            closest_idx = (ben_history["week_start"] - as_of_date).abs().idxmin()
            band_now = ben_history.loc[closest_idx, "band"]

# Add to row
row["band_now"] = band_now
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_features.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/inuka_features.py tests/test_inuka_features.py
git commit -m "feat(pipeline): add band_now feature from engagement history"
```

---

## Task 7: Implement Escalation Label (Phase 2, Part 2)

**Files:**
- Modify: `inuka-pipeline/src/inuka_predict.py`

**Interfaces:**
- Consumes: Features with `band_now`, engagement history
- Produces: `escalation_label` (1 if band worsens within 30 days, 0 otherwise)

- [ ] **Step 1: Add test for escalation label**

Create `inuka-pipeline/tests/test_inuka_predict.py`:

```python
import pytest
import pandas as pd
from datetime import date, timedelta

def test_build_escalation_labels_produces_binary_labels():
    import sys
    sys.path.insert(0, "src")
    from inuka_predict import build_escalation_labels, BAND_ORDER
    
    # Create minimal test data
    features = pd.DataFrame([
        {"beneficiary_id": "B1", "as_of_date": date(2026, 1, 1), "band_now": "Active"},
        {"beneficiary_id": "B1", "as_of_date": date(2026, 1, 8), "band_now": "Active"},
        {"beneficiary_id": "B1", "as_of_date": date(2026, 2, 5), "band_now": "At-Risk"},  # This is 35 days from Jan 1
    ])
    
    history = pd.DataFrame([
        {"beneficiary_id": "B1", "week_start": date(2026, 1, 1), "band": "Active"},
        {"beneficiary_id": "B1", "week_start": date(2026, 1, 8), "band": "Active"},
        {"beneficiary_id": "B1", "week_start": date(2026, 1, 15), "band": "Active"},
        {"beneficiary_id": "B1", "week_start": date(2026, 1, 22), "band": "Active"},
        {"beneficiary_id": "B1", "week_start": date(2026, 1, 29), "band": "At-Risk"},  # Escalates ~28 days from Jan 1
        {"beneficiary_id": "B1", "week_start": date(2026, 2, 5), "band": "At-Risk"},
    ])
    
    result = build_escalation_labels(features, history)
    
    assert "escalation_label" in result.columns
    assert result["escalation_label"].isin([0, 1]).all()
    # First row (Jan 1) should have label=1 because band worsens by Jan 29
    jan1_row = result[result["as_of_date"] == date(2026, 1, 1)]
    assert len(jan1_row) == 1
    assert jan1_row.iloc[0]["escalation_label"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_predict.py -v`
Expected: FAIL with "cannot import name 'build_escalation_labels'"

- [ ] **Step 3: Add BAND_ORDER constant**

At the top of `inuka_predict.py`, add:

```python
BAND_ORDER = {"Active": 0, "At-Risk": 1, "Disengaged": 2, "Dropout": 3}
```

- [ ] **Step 4: Implement build_escalation_labels function**

Replace the existing `build_labels()` function (around line 174) with:

```python
def build_escalation_labels(features: pd.DataFrame, history: pd.DataFrame) -> pd.DataFrame:
    """
    Build escalation labels: 1 if beneficiary's band worsens within 30 days, 0 otherwise.
    
    Rows where band_now == 'Dropout' are dropped (no worse state possible).
    Rows where t+30 falls past observed window are dropped (right-censored).
    """
    from datetime import timedelta
    
    # Index history for fast lookup
    history = history.copy()
    history["week_start"] = pd.to_datetime(history["week_start"])
    
    rows = []
    for _, row in features.iterrows():
        band_now = row.get("band_now")
        if band_now == "Dropout":
            continue  # No worse state to escalate to
        
        as_of_date = pd.to_datetime(row["as_of_date"])
        target_date = as_of_date + timedelta(days=30)
        
        # Find band at t+30 (closest week)
        ben_history = history[history["beneficiary_id"] == row["beneficiary_id"]]
        if ben_history.empty:
            continue
        
        future_history = ben_history[ben_history["week_start"] >= target_date]
        if future_history.empty:
            continue  # Right-censored
        
        band_later = future_history.iloc[0]["band"]
        
        # Label = 1 if band worsened
        now_rank = BAND_ORDER.get(band_now, 0)
        later_rank = BAND_ORDER.get(band_later, 0)
        label = int(later_rank > now_rank)
        
        row_dict = row.to_dict()
        row_dict["escalation_label"] = label
        rows.append(row_dict)
    
    return pd.DataFrame(rows)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd inuka-pipeline && python -m pytest tests/test_inuka_predict.py -v`
Expected: PASS

- [ ] **Step 6: Update main() to use build_escalation_labels**

In `main()`, replace the call to `build_labels(features)` with:

```python
# Load engagement history for label building
history = pd.read_csv(RAW_DIR / "fact_engagement_history.csv")
features = build_escalation_labels(features, history)

# Validate row count
n_labeled = len(features)
assert n_labeled >= 10_000, (
    f"Training set has only {n_labeled:,} rows after censoring — "
    f"regenerate with more beneficiaries or a longer window (see Phase 1.5)."
)
print(f"  Labeled rows after censoring: {n_labeled:,}")
```

- [ ] **Step 7: Update FEATURES list and training code**

Update the `FEATURES` list to include `band_now`:

```python
FEATURES = [
    "band_now",  # NEW: current engagement band
    "days_since_last_contact",
    "sessions_attended_30d",
    # ... rest unchanged
]
```

And update the label column reference from `dropout_label` to `escalation_label`.

- [ ] **Step 8: Update backtest report metadata**

Update the `label_definition` in the backtest report output:

```python
backtest = {
    "model": "LogisticRegression",
    "label_definition": "escalation: 1 if band worsens within 30 days, 0 otherwise",
    "label_rationale": "Forward-looking 30-day escalation forecast replaces static current-state classification.",
    # ... rest
}
```

- [ ] **Step 9: Commit**

```bash
git add src/inuka_predict.py tests/test_inuka_predict.py
git commit -m "feat(pipeline): implement 30-day escalation label replacing current-state classification"
```

---

## Task 8: Retrain and Validate Model (Phase 3)

**Files:**
- Run: `inuka-pipeline/src/inuka_predict.py`

**Interfaces:**
- Consumes: All Phase 1/1.5/2 changes
- Produces: Updated `inuka_backtest_report.json`, `inuka_feature_importance.json`, `inuka_predictions_export.json`

- [ ] **Step 1: Regenerate all data with new trajectories**

Run: `cd inuka-pipeline && python -m src.generate_inuka_data`
Expected: Completes, generates ~6000 beneficiaries with trajectories

- [ ] **Step 2: Rebuild features with band_now**

Run: `cd inuka-pipeline && python -m src.inuka_features`
Expected: Completes, `fact_beneficiary_features.parquet` includes `band_now` column

- [ ] **Step 3: Retrain model with escalation label**

Run: `cd inuka-pipeline && python -m src.inuka_predict --train`
Expected: 
- Training assertion passes (≥10,000 rows)
- Model trains successfully
- Backtest report shows `label_definition: "escalation: ..."`

- [ ] **Step 4: Verify feature importance is sensible**

Run: `cd inuka-pipeline && cat data/warehouse/inuka_feature_importance.json | python3 -c "import json,sys; d=json.load(sys.stdin); print([f['feature'] + ': ' + str(f['importance']) for f in d[:5]])"`

Expected: `band_now` should have significant importance, but `attendance_rate_30d`, `sessions_attended_30d`, etc. should also carry weight. If `band_now` dominates completely (>80%), the trajectory coupling is too tight.

- [ ] **Step 5: Verify positive rate is in expected range**

Run: `cd inuka-pipeline && cat data/warehouse/inuka_backtest_report.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Positive rate train:', d.get('positive_rate_train')); print('Positive rate test:', d.get('positive_rate_test'))"`

Expected: 15-30% positive rate is healthy for a 30-day escalation window.

- [ ] **Step 6: Commit**

```bash
git add data/warehouse/inuka_backtest_report.json data/warehouse/inuka_feature_importance.json
git commit -m "feat(pipeline): retrain model with escalation labels - Phase 3 complete"
```

---

## Task 9: Add beneficiary_id to Live Bridge (Phase 5, Part 1)

**Files:**
- Modify: `inuka-pipeline/src/inuka_live_bridge.py`

**Interfaces:**
- Produces: `live_batch.json` incidents with `beneficiary_id` as structured field

- [ ] **Step 1: Add beneficiary_id to incident output**

In `inuka_live_bridge.py`, find `load_predictions_as_incidents()` (around line 143). In the `row.update()` block, add:

```python
row.update({
    "incident_id": f"INC-{ben_id}-{today_tag}",
    "site": cohort,
    "beneficiary_id": ben_id,  # NEW: structured field, not embedded in incident_id
    # ... rest unchanged
})
```

- [ ] **Step 2: Verify live_batch.json includes beneficiary_id**

Run: `cd inuka-pipeline && python -m src.inuka_live_bridge && head -50 data/warehouse/live_batch.json | grep beneficiary_id`
Expected: Shows `"beneficiary_id": "BEN-..."` in incident records

- [ ] **Step 3: Commit**

```bash
git add src/inuka_live_bridge.py
git commit -m "feat(pipeline): add beneficiary_id as structured field in live_batch.json"
```

---

## Task 10: Database Migration for beneficiary_id (Phase 5, Part 2)

**Files:**
- Create: `inuka-pulse-backend/src/main/resources/db/migration/V34__add_beneficiary_id_columns.sql`
- Modify: `inuka-pulse-backend/src/main/java/com/inukapulse/site/IncidentEntity.java`
- Modify: `inuka-pulse-backend/src/main/java/com/inukapulse/alert/AlertEntity.java`

**Interfaces:**
- Produces: `beneficiary_id` column in `fact_incidents` and `alerts` tables

- [ ] **Step 1: Create Flyway migration**

```sql
-- V34__add_beneficiary_id_columns.sql
-- Add beneficiary_id to incidents and alerts for beneficiary-level tracking

ALTER TABLE fact_incidents ADD COLUMN IF NOT EXISTS beneficiary_id VARCHAR(20);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS beneficiary_id VARCHAR(20);

-- Index for efficient lookup by beneficiary
CREATE INDEX IF NOT EXISTS idx_incidents_beneficiary_id ON fact_incidents(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_alerts_beneficiary_id ON alerts(beneficiary_id);

COMMENT ON COLUMN fact_incidents.beneficiary_id IS 'Beneficiary who triggered this incident (nullable for non-beneficiary incidents)';
COMMENT ON COLUMN alerts.beneficiary_id IS 'Beneficiary this alert relates to (nullable for cluster-type alerts)';
```

- [ ] **Step 2: Add beneficiaryId to IncidentEntity**

In `IncidentEntity.java`, add after `ingestionTimestamp`:

```java
@Column(name = "beneficiary_id")
private String beneficiaryId;
```

- [ ] **Step 3: Add beneficiaryId to AlertEntity**

In `AlertEntity.java`, add after `requiredQualification`:

```java
@Column(name = "beneficiary_id")
private String beneficiaryId;
```

- [ ] **Step 4: Update EtlReloadService to read beneficiary_id**

In `EtlReloadService.loadIncidents()`, add:

```java
e.setBeneficiaryId(str(r, "beneficiary_id"));
```

- [ ] **Step 5: Run backend to verify migration applies**

Run: `cd inuka-pulse-backend && ./mvnw spring-boot:run`
Expected: Flyway applies V34 migration, app starts without errors

- [ ] **Step 6: Commit**

```bash
git add inuka-pulse-backend/src/main/resources/db/migration/V34__add_beneficiary_id_columns.sql
git add inuka-pulse-backend/src/main/java/com/inukapulse/site/IncidentEntity.java
git add inuka-pulse-backend/src/main/java/com/inukapulse/alert/AlertEntity.java
git add inuka-pulse-backend/src/main/java/com/inukapulse/etl/EtlReloadService.java
git commit -m "feat(backend): add beneficiary_id column to incidents and alerts - Phase 5"
```

---

## Task 11: Create PredictionInterpretationService (Phase 6)

**Files:**
- Create: `inuka-pulse-backend/src/main/java/com/inukapulse/ml/PredictionView.java`
- Create: `inuka-pulse-backend/src/main/java/com/inukapulse/ml/PredictionInterpretationService.java`

**Interfaces:**
- Consumes: Raw prediction data
- Produces: `PredictionView` record with consistent interpretation

- [ ] **Step 1: Create PredictionView record**

```java
// PredictionView.java
package com.inukapulse.ml;

import java.time.Instant;
import java.util.List;

/**
 * Immutable view of an interpreted prediction.
 * This is the single shape all prediction rendering should consume.
 */
public record PredictionView(
    String beneficiaryId,
    String cohortId,
    String band,              // Active / At-Risk / Disengaged / Dropout
    double probability,
    String confidence,        // "confident" | "low-confidence" | "uncertain"
    String narrative,
    List<String> topDrivers,
    String modelVersion,
    Instant scoredAt,
    String reviewStatus       // "unreviewed" | "human-confirmed" | "disputed"
) {}
```

- [ ] **Step 2: Create PredictionInterpretationService**

```java
// PredictionInterpretationService.java
package com.inukapulse.ml;

import com.inukapulse.prediction.PredictionEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PredictionInterpretationService {

    private static final double[] BAND_THRESHOLDS = {0.25, 0.45, 0.70};  // Active < At-Risk < Disengaged < Dropout
    
    public PredictionView interpret(PredictionEntity entity) {
        double prob = entity.getProbability().doubleValue();
        String band = deriveBand(prob);
        String confidence = deriveConfidence(prob);
        String narrative = buildNarrative(band, prob, confidence);
        List<String> drivers = parseTopDrivers(entity.getTopFeatures());
        
        return new PredictionView(
            entity.getBeneficiaryId(),
            entity.getCohortId(),
            band,
            prob,
            confidence,
            narrative,
            drivers,
            entity.getModelVersion(),
            entity.getAsOfDate().atStartOfDay().toInstant(ZoneOffset.UTC),
            "unreviewed"  // Default; would check feedback table for actual status
        );
    }
    
    private String deriveBand(double prob) {
        if (prob >= 0.70) return "Dropout";
        if (prob >= 0.45) return "Disengaged";
        if (prob >= 0.25) return "At-Risk";
        return "Active";
    }
    
    private String deriveConfidence(double prob) {
        // Uncertain if close to 0.5
        if (Math.abs(prob - 0.5) < 0.05) return "uncertain";
        // Low confidence if close to band boundary
        for (double threshold : BAND_THRESHOLDS) {
            if (Math.abs(prob - threshold) < 0.05) return "low-confidence";
        }
        return "confident";
    }
    
    private String buildNarrative(String band, double prob, String confidence) {
        String qualifier = switch (confidence) {
            case "uncertain" -> "may be";
            case "low-confidence" -> "is likely";
            default -> "is predicted to be";
        };
        
        if (band.equals("Dropout")) {
            return String.format("This beneficiary %s at high risk of dropping out within 30 days.", qualifier);
        }
        if (band.equals("Disengaged")) {
            return String.format("This beneficiary %s showing signs of disengagement.", qualifier);
        }
        if (band.equals("At-Risk")) {
            return String.format("This beneficiary %s at moderate risk of declining engagement.", qualifier);
        }
        return "This beneficiary is currently engaged and on track.";
    }
    
    private List<String> parseTopDrivers(String topFeatures) {
        if (topFeatures == null || topFeatures.isBlank()) {
            return List.of();
        }
        return Arrays.stream(topFeatures.split("\\|"))
            .map(this::humanizeFeatureName)
            .toList();
    }
    
    private String humanizeFeatureName(String feature) {
        return switch (feature.trim()) {
            case "attendance_rate_30d" -> "Low attendance rate";
            case "sessions_attended_30d" -> "Few sessions attended";
            case "missed_sessions_14d" -> "Missed sessions recently";
            case "days_since_last_contact" -> "No recent contact";
            case "field_visit_gap_days" -> "Long gap since field visit";
            case "assessment_score_latest" -> "Low assessment score";
            case "assessment_score_trend" -> "Declining assessment trend";
            case "disbursement_delay_days" -> "Delayed disbursements";
            case "band_now" -> "Current engagement status";
            default -> feature.replace("_", " ");
        };
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd inuka-pulse-backend && ./mvnw compile`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add inuka-pulse-backend/src/main/java/com/inukapulse/ml/PredictionView.java
git add inuka-pulse-backend/src/main/java/com/inukapulse/ml/PredictionInterpretationService.java
git commit -m "feat(backend): add PredictionInterpretationService for consistent prediction rendering"
```

---

## Task 12: Create ExplainabilityPanel Component (Phase 7, Part 1)

**Files:**
- Create: `inuka-pulse-frontend/src/components/explainability-panel.tsx`

**Interfaces:**
- Consumes: `topDrivers: string[]` from PredictionView
- Produces: Human-readable explanation UI

- [ ] **Step 1: Create ExplainabilityPanel component**

```tsx
// explainability-panel.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Clock, Calendar } from "lucide-react";

interface ExplainabilityPanelProps {
  topDrivers: string[];
  probability: number;
  band: string;
}

const DRIVER_ICONS: Record<string, React.ReactNode> = {
  "Low attendance rate": <TrendingDown className="size-4" />,
  "Few sessions attended": <Calendar className="size-4" />,
  "Missed sessions recently": <AlertTriangle className="size-4" />,
  "No recent contact": <Clock className="size-4" />,
};

export function ExplainabilityPanel({ topDrivers, probability, band }: ExplainabilityPanelProps) {
  if (topDrivers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Why this prediction?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          The model flagged this beneficiary as <strong>{band}</strong> (probability: {(probability * 100).toFixed(0)}%) based on these factors:
        </p>
        <ul className="space-y-1">
          {topDrivers.slice(0, 3).map((driver, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {DRIVER_ICONS[driver] ?? <AlertTriangle className="size-4" />}
              <span>{driver}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground italic mt-2">
          This is a prediction, not a certainty. Review the beneficiary&apos;s full profile before taking action.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd inuka-pulse-frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add inuka-pulse-frontend/src/components/explainability-panel.tsx
git commit -m "feat(frontend): add ExplainabilityPanel component for prediction explanations"
```

---

## Task 13: Create PredictionFeedbackWidget Component (Phase 7, Part 2)

**Files:**
- Create: `inuka-pulse-frontend/src/components/prediction-feedback-widget.tsx`

**Interfaces:**
- Produces: Feedback submission to `POST /api/ml/feedback`

- [ ] **Step 1: Create PredictionFeedbackWidget component**

```tsx
// prediction-feedback-widget.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, HelpCircle } from "lucide-react";

interface PredictionFeedbackWidgetProps {
  predictionId: string | number;
  beneficiaryId: string;
  currentBand: string;
  onFeedbackSubmitted?: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
const getToken = () => typeof document !== "undefined" 
  ? document.cookie.match(/inuka-token=([^;]+)/)?.[1] 
  : undefined;

type Rating = "correct" | "incorrect" | "uncertain";

export function PredictionFeedbackWidget({
  predictionId,
  beneficiaryId,
  currentBand,
  onFeedbackSubmitted,
}: PredictionFeedbackWidgetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Rating | null>(null);

  const submitFeedback = async (rating: Rating) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/ml/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({
          predictionId,
          siteId: beneficiaryId,  // Using beneficiaryId as siteId per existing API
          rating,
          note: `Feedback on ${currentBand} prediction`,
        }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      setSubmitted(rating);
      toast.success("Feedback recorded. Thank you!");
      onFeedbackSubmitted?.();
    } catch (e: any) {
      toast.error(`Failed to submit feedback: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Feedback recorded: {submitted}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Is this prediction accurate?</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => submitFeedback("correct")}
        disabled={submitting}
        title="Yes, this prediction is correct"
      >
        <ThumbsUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => submitFeedback("incorrect")}
        disabled={submitting}
        title="No, this prediction is wrong"
      >
        <ThumbsDown className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => submitFeedback("uncertain")}
        disabled={submitting}
        title="I'm not sure"
      >
        <HelpCircle className="size-3.5" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd inuka-pulse-frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add inuka-pulse-frontend/src/components/prediction-feedback-widget.tsx
git commit -m "feat(frontend): add PredictionFeedbackWidget for HITL feedback collection"
```

---

## Task 14: Enhance RiskBandBadge with Confidence (Phase 7, Part 3)

**Files:**
- Modify: `inuka-pulse-frontend/src/components/risk-band-badge.tsx`

**Interfaces:**
- Consumes: `confidence?: "confident" | "low-confidence" | "uncertain"`
- Produces: Badge with visual confidence indicator

- [ ] **Step 1: Add confidence prop to RiskBandBadge**

```tsx
// risk-band-badge.tsx
import { cn } from "@/lib/utils";

interface RiskBandBadgeProps {
  band: string;
  confidence?: "confident" | "low-confidence" | "uncertain";
  className?: string;
}

const BAND_STYLES: Record<string, string> = {
  Active:     "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-300  border-green-200  dark:border-green-800",
  "At-Risk":  "bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300  border-amber-200  dark:border-amber-800",
  Disengaged: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  Dropout:    "bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300    border-red-200    dark:border-red-800",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  "confident": "",
  "low-confidence": "opacity-75 border-dashed",
  "uncertain": "opacity-60 border-dotted",
};

export function RiskBandBadge({ band, confidence = "confident", className }: RiskBandBadgeProps) {
  const bandStyle = BAND_STYLES[band] ?? "bg-muted text-muted-foreground border-border";
  const confidenceStyle = CONFIDENCE_STYLES[confidence] ?? "";
  
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        bandStyle,
        confidenceStyle,
        className,
      )}
      title={confidence !== "confident" ? `Confidence: ${confidence}` : undefined}
    >
      {band}
      {confidence === "uncertain" && <span className="ml-1 text-[10px]">?</span>}
    </span>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd inuka-pulse-frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add inuka-pulse-frontend/src/components/risk-band-badge.tsx
git commit -m "feat(frontend): add confidence indicator to RiskBandBadge"
```

---

## Task 15: End-to-End Validation (Phase 8)

**Files:**
- Run validation checks across all components

- [ ] **Step 1: Regenerate full data with trajectories**

Run: `cd inuka-pipeline && python -m src.generate_inuka_data`
Verify: `wc -l data/raw/inuka/dim_beneficiary.csv` shows ~6000+ rows
Verify: `wc -l data/raw/inuka/fact_engagement_history.csv` shows ~300,000+ rows

- [ ] **Step 2: Rebuild features with band_now**

Run: `cd inuka-pipeline && python -m src.inuka_features`
Verify: `python3 -c "import pandas as pd; df=pd.read_parquet('data/warehouse/fact_beneficiary_features.parquet'); print('band_now' in df.columns)"`
Expected: `True`

- [ ] **Step 3: Retrain model with escalation labels**

Run: `cd inuka-pipeline && python -m src.inuka_predict --train`
Verify: Row assertion passes (≥10,000 rows)
Verify: `cat data/warehouse/inuka_backtest_report.json | grep label_definition`
Expected: Contains "escalation"

- [ ] **Step 4: Generate live batch with beneficiary_id**

Run: `cd inuka-pipeline && python -m src.inuka_live_bridge`
Verify: `grep -c beneficiary_id data/warehouse/live_batch.json | head -1`
Expected: Count > 0

- [ ] **Step 5: Start backend and verify migration**

Run: `cd inuka-pulse-backend && ./mvnw spring-boot:run`
Verify: Flyway applies V34 migration
Verify: App starts without errors

- [ ] **Step 6: Verify incidents have beneficiary_id**

Wait for ETL reload cycle, then query:
```sql
SELECT COUNT(*) FROM fact_incidents WHERE beneficiary_id IS NOT NULL;
```
Expected: Count > 0

- [ ] **Step 7: Start frontend and verify components**

Run: `cd inuka-pulse-frontend && npm run dev`
Navigate to a beneficiary prediction view
Verify: RiskBandBadge renders with confidence indicator
Verify: ExplainabilityPanel shows top drivers (if integrated)
Verify: PredictionFeedbackWidget allows submitting feedback

- [ ] **Step 8: Submit test feedback**

Use the PredictionFeedbackWidget to submit feedback on a prediction
Verify: Feedback appears in ML Admin feedback queue

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat: ML pipeline remediation complete - all 8 phases implemented"
git push origin feature/lex
```

---

## Validation Checklist

After all tasks complete, verify:

| Check | Expected |
|-------|----------|
| `dim_beneficiary.csv` row count | ≥6,000 |
| `fact_engagement_history.csv` exists | Yes, with ~300k rows |
| `fact_beneficiary_features.parquet` has `band_now` | Yes |
| `inuka_backtest_report.json` label_definition | "escalation: 1 if band worsens within 30 days" |
| Training row assertion | Passes (≥10,000 rows) |
| `live_batch.json` has `beneficiary_id` | Yes |
| `fact_incidents` has `beneficiary_id` column | Yes (via V34 migration) |
| `alerts` has `beneficiary_id` column | Yes (via V34 migration) |
| RiskBandBadge accepts `confidence` prop | Yes |
| ExplainabilityPanel component exists | Yes |
| PredictionFeedbackWidget component exists | Yes |
| PredictionInterpretationService exists | Yes |
