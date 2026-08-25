# Task 3: Generate fact_engagement_history.csv

## Files
- Modify: `inuka-pipeline/src/generate_inuka_data.py`

## Interfaces
- Consumes: Beneficiaries with `trajectory` field (from Task 2)
- Produces: `data/raw/inuka/fact_engagement_history.csv` with columns `beneficiary_id, week_start, band`

## Steps

### Step 1: Add test for engagement history generation

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

### Step 2: Run test to verify it fails

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_engagement_history_creates_weekly_records -v`
Expected: FAIL with "cannot import name 'build_engagement_history'"

### Step 3: Implement build_engagement_history function

Add after `build_trajectory` in generate_inuka_data.py:

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

### Step 4: Run test to verify it passes

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_engagement_history_creates_weekly_records -v`
Expected: PASS

### Step 5: Integrate into main() and write CSV

Find the `main()` function. After `beneficiaries = build_beneficiaries(cohorts)`, add:

```python
# 2a. fact_engagement_history — weekly band snapshots per beneficiary
engagement_history = build_engagement_history(beneficiaries)
pd.DataFrame(engagement_history).to_csv(
    RAW_DIR / "fact_engagement_history.csv", index=False
)
print(f"  fact_engagement_history.csv: {len(engagement_history):,} rows")
```

### Step 6: Run full generation and verify file exists

Run: `cd inuka-pipeline && python -m src.generate_inuka_data && head -5 data/raw/inuka/fact_engagement_history.csv`
Expected: CSV with header `beneficiary_id,week_start,band` and data rows

### Step 7: Commit

```bash
git add src/generate_inuka_data.py tests/test_generate_inuka_data.py
git commit -m "feat(pipeline): generate fact_engagement_history.csv with weekly band snapshots"
```
