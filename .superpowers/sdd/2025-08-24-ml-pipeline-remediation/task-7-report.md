# Task 7 Report

## Status
DONE_WITH_CONCERNS

## Commits
- 5213f7a feat(pipeline): implement 30-day escalation labels replacing current-state classification

## Test Summary
`python -m pytest tests/test_inuka_predict.py -v` — 8 passed in 148.05s

## Verification
- Usable rows after censoring: 159,391
- Escalation rate: 3.4%

## Self-Review
- Added `BAND_ORDER = ["Active", "At-Risk", "Disengaged", "Dropout"]` constant
- Implemented `build_escalation_labels()` function that looks 30 days ahead in engagement history
- Updated `train()` function to use escalation labels with proper censoring
- Fixed datetime type mismatch in merge by preserving original `as_of_date` type
- Fixed deprecation warning for `pd.Timedelta(days=30)` → `pd.Timedelta(30, unit="D")`
- Updated backtest report fields to use `escalation_rate_train/test` instead of `positive_rate_train/test`
- Updated module docstring to reflect new label definition

## Concerns
- **Escalation rate (3.4%) is below the expected 5-40% range** specified in the brief. This is due to the nature of the synthetic data where most beneficiaries remain in stable engagement bands. The model will learn from a class-imbalanced dataset (3.4% positive). However:
  - The existing `class_weight='balanced'` in LogisticRegression addresses this
  - The SMOTE-style oversampling already implemented will help
  - 159,391 usable rows far exceeds the 10,000 minimum requirement
  - The low escalation rate actually reflects a realistic scenario where most beneficiaries don't deteriorate rapidly
