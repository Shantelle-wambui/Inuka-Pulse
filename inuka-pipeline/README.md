# inuka-pipeline

Python ETL pipeline and AI dropout prediction model for the Inuka Pulse platform.

## What It Does

1. **Generates** synthetic Inuka beneficiary data across 4 pillars (Scholarship, Plus, Vocational, Tech) and Kenyan counties
2. **Engineers features** from raw programme data (attendance, disbursements, field visits, assessments)
3. **Predicts** which beneficiaries are at risk of dropping out (logistic regression model)
4. **Bridges** predictions to the Java backend every 60 seconds via `live_batch.json`

## Structure

```
inuka-pipeline/
├── src/
│   ├── generate_inuka_data.py   # Generate synthetic beneficiary datasets
│   ├── inuka_features.py        # Feature engineering
│   ├── inuka_predict.py         # Train & run dropout prediction model
│   ├── inuka_diagnostics.py     # Analytics: control charts, survival curves
│   └── inuka_live_bridge.py     # Convert predictions → live_batch.json
├── data/
│   ├── raw/inuka/               # Raw CSV datasets (generated or real)
│   └── warehouse/               # Processed outputs: predictions, model exports
├── models/                      # Trained model files (.pkl)
├── docs/
│   └── inuka_data_generation_notes.md
├── run_inuka_pipeline.sh        # Full pipeline run (generate → predict)
└── run_live.sh                  # Live ETL loop (runs bridge every 60s)
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# 1. Generate synthetic data
python3 src/generate_inuka_data.py

# 2. Train model and generate predictions
python3 src/inuka_predict.py

# 3. Push predictions to the backend (one-shot)
python3 src/inuka_live_bridge.py

# 4. Run live loop (continuous, every 60s)
./run_live.sh
```

## Data Sources

| File | Description |
|---|---|
| `dim_beneficiary.csv` | Beneficiary profiles (age, gender, county, pillar, cohort) |
| `dim_cohort.csv` | Cohort definitions |
| `fact_sessions.csv` | Attendance and session engagement records |
| `fact_disbursements.csv` | Disbursement events per beneficiary |
| `fact_field_visits.csv` | Field officer visit records |
| `fact_assessments.csv` | Assessment scores per beneficiary |

## Model

- **Algorithm**: Logistic Regression (scikit-learn)
- **Target**: Binary dropout risk (0 = engaged, 1 = dropout)
- **Key features**: `attendance_rate_30d`, `missed_sessions_14d`, `days_since_last_visit`, `missed_disbursements`, `assessment_score_trend`
- **Output**: `inuka_predictions_export.json` — dropout probability per beneficiary
