# Task 8: Retrain and Validate Model (Phase 3)

## Files
- Run: `inuka-pipeline/src/inuka_predict.py` (train command)
- Verify: `inuka-pipeline/data/warehouse/` output files

## Interfaces
- Consumes: Features with `band_now`, escalation labels
- Produces:
  - `models/inuka_logreg_v1.pkl` (retrained model)
  - `data/warehouse/inuka_backtest_report.json` (with escalation metrics)
  - `data/warehouse/inuka_feature_importance.json`
  - `data/warehouse/outcome_model_metrics.json`

## Context

Phases 1-2 are complete:
- 6,251 beneficiaries, 52-week window
- `band_now` feature added
- Escalation labels (30-day forward-looking) implemented
- 159,391 usable rows, 3.4% escalation rate

Now we retrain the model with the new escalation labels and validate it produces sensible metrics.

## Steps

### Step 1: Run full training pipeline

```bash
cd inuka-pipeline && python -m src.inuka_predict train
```

This will:
1. Build features (with band_now)
2. Build escalation labels
3. Merge and censor
4. Train logistic regression with GridSearchCV
5. Save model and generate backtest report

Expected runtime: 2-10 minutes depending on machine.

### Step 2: Verify model file was created/updated

```bash
ls -la inuka-pipeline/models/inuka_logreg_v1.pkl
```
Expected: File exists and was recently modified

### Step 3: Verify backtest report has escalation metrics

```bash
cat inuka-pipeline/data/warehouse/inuka_backtest_report.json | python3 -c "
import sys, json
report = json.load(sys.stdin)
print('Rows used:', report.get('total_samples'))
print('Escalation rate (train):', report.get('escalation_rate_train'))
print('Escalation rate (test):', report.get('escalation_rate_test'))
print('ROC-AUC:', report.get('test_roc_auc'))
print('F2-score:', report.get('test_fbeta'))
print('Optimal threshold:', report.get('optimal_threshold'))
"
```

Expected:
- total_samples ≥ 10,000
- escalation_rate_train ≈ 3-5%
- ROC-AUC ≥ 0.60 (model learned something)
- F2-score > 0 (recall-weighted performance)

### Step 4: Verify feature importance includes band_now

```bash
cat inuka-pipeline/data/warehouse/inuka_feature_importance.json | python3 -c "
import sys, json
fi = json.load(sys.stdin)
print('Features:', list(fi.keys())[:5], '...')
print('band_now' in fi if isinstance(fi, dict) else 'band_now in list')
"
```

Note: band_now is categorical and may not appear directly if not encoded, or may appear as encoded dummy variables. Check the actual structure.

### Step 5: Verify outcome metrics file

```bash
ls -la inuka-pipeline/data/warehouse/outcome_model_metrics.json
cat inuka-pipeline/data/warehouse/outcome_model_metrics.json | head -20
```

### Step 6: Run any existing tests to ensure nothing broke

```bash
cd inuka-pipeline && python -m pytest tests/ -v --tb=short
```

Expected: All tests pass

### Step 7: Commit (if any code changes were needed)

If training required any code fixes:
```bash
git add -A && git commit -m "fix(pipeline): adjustments for model retraining"
```

If no code changes:
```bash
# No commit needed - just verified the training works
```

### Step 8: Record results in report

Record the key metrics from backtest report in the task report.
