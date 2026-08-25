# Task 4 Report

## Status
DONE

## Commits
- 3031768 feat(pipeline): drive attendance/visits/assessments from weekly trajectory band

## Test Summary
`pytest tests/test_generate_inuka_data.py -v` — 6/6 passed

## Self-Review
- Fixed TypeError in `build_field_visits()` where `TODAY` (datetime) was compared with `enroll_date` (date) — converted to `.date()` for comparison
- `build_sessions()`: Now uses `BAND_ATTEND_RATES` dict mapping band to attendance probability, calculates week index from enrollment date to determine current band
- `build_field_visits()`: Now generates visits up to dropout week, uses band-based outcome weights and visit count weights that vary by engagement level
- `build_assessments()`: Removed blanket dropout skip, now generates assessments up until dropout week with band-influenced scores

## Concerns (if any)
None. Full data generation completes successfully with expected row counts.
