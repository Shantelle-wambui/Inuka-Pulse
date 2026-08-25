# Task 6 Report

## Status
DONE

## Commits
- bb73b7d feat(pipeline): add band_now feature from engagement history

## Test Summary
`pytest tests/test_inuka_features.py -v` — 1 passed in 319s

## Self-Review
- Optimized the engagement history lookup by pre-grouping into a dictionary (`engagement_by_ben`) to avoid repeated DataFrame filtering in the nested loop
- Added `band_now` to the `FEATURES` list for documentation completeness
- Test uses 14-day window to reduce runtime while still validating the feature

## Concerns (if any)
None. Feature builds correctly with all 4 band values appearing in the output.
