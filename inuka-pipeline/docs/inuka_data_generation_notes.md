# Inuka Pulse — Data Generation Notes

## Design Choices

### High-Risk Cohorts
Two cohorts are seeded with weak-engagement patterns (mirrors KPC's Makueni/Sinendet):

| Cohort ID       | Pillar     | County  | Pattern                                              |
|-----------------|------------|---------|------------------------------------------------------|
| COHORT-VN-003   | Vocational | Nakuru  | High dropout rate, low session attendance (55%)       |
| COHORT-TC-007   | Tech       | Kisumu  | Frequent disbursement delays, lower assessment scores |

### Injected Data Quality Issues
Every issue is logged to `ground_truth_issues.csv` for detection-rate calculation.

| Issue Type              | Rate  | Outcome            |
|-------------------------|-------|--------------------|
| `mixed_date_format`     | ~10%  | Corrected          |
| `dirty_label`           | ~8%   | Corrected          |
| `missing_required_field`| ~3%   | Review             |
| `out_of_range`          | ~2.5% | Rejected/Corrected |
| `future_date`           | ~4%   | Rejected           |

### Volume
- ~2 000 beneficiaries
- ~52 000 session attendance events (weekly × 26 weeks)
- ~3 500 field visits
- ~12 000 disbursement records
- ~4 000 assessment records
