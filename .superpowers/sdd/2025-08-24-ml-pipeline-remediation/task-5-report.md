# Task 5 Report

## Status
DONE

## Commits
- 1f4b1c8 feat(pipeline): scale dataset to 6000+ beneficiaries and 52-week window

## Test Summary
`python -m pytest tests/test_generate_inuka_data.py -v` — 6 passed

## Data Scale Verification
- dim_beneficiary.csv rows: 6,251 (6,250 + header)
- fact_engagement_history.csv rows: 325,001 (325,000 + header)

## Self-Review
All changes applied cleanly:
1. Beneficiary count per cohort: 220-320 (high-risk) / 260-380 (normal)
2. Time window: 364 days (52 weeks)
3. Trajectory length defaults: 52 weeks in both functions
4. Dwell times for gradual_decline adjusted for longer window
5. inuka_features.py default days_back: 364
6. Test assertions updated from 26 to 52 weeks

## Concerns (if any)
None
