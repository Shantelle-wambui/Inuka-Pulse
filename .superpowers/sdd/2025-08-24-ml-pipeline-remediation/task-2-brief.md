# Task 2: Integrate Trajectories into Beneficiary Generation

## Files
- Modify: `inuka-pipeline/src/generate_inuka_data.py`

## Interfaces
- Consumes: `build_trajectory(is_high_risk, n_weeks) -> list[str]` (from Task 1)
- Produces: Each beneficiary dict now has `trajectory: list[str]` field
- Produces: `current_status` is `trajectory[-1]` (final week's band)

## Steps

### Step 1: Add test for beneficiary trajectory field

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

### Step 2: Run test to verify it fails

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_beneficiaries_includes_trajectory -v`
Expected: FAIL with "KeyError: 'trajectory'"

### Step 3: Modify build_beneficiaries to generate trajectories

Find `build_beneficiaries()` (around line 235). Replace the status assignment block.

Look for code like:
```python
status = random.choices(ENGAGEMENT_LEVELS, weights=...)[0]
dropout_date = None
dropout_reason = None
if status == "Dropout":
    dropout_date = rand_date(...)
    dropout_reason = random.choice(DROPOUT_REASONS)
```

Replace with:
```python
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

### Step 4: Add trajectory to beneficiary dict

In the same function, find where the beneficiary dict is built and add the trajectory field:

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

### Step 5: Run test to verify it passes

Run: `cd inuka-pipeline && python -m pytest tests/test_generate_inuka_data.py::test_build_beneficiaries_includes_trajectory -v`
Expected: PASS

### Step 6: Commit

```bash
git add src/generate_inuka_data.py tests/test_generate_inuka_data.py
git commit -m "feat(pipeline): integrate trajectories into beneficiary generation"
```
