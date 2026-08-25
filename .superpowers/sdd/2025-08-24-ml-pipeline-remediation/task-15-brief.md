# Task 15: End-to-End Validation (Phase 8)

## Purpose

Verify that all 8 defect fixes from the ML Pipeline Remediation plan are working end-to-end:
1. Model now predicts 30-day escalation (not current-state classification)
2. beneficiary_id threads through the alert→incident→CAPA chain
3. Backend interpretation service provides explainability
4. Frontend components display interpretations

## Validation Steps

### Step 1: Run Python pipeline tests

```bash
cd inuka-pipeline && python -m pytest tests/ -v --tb=short 2>&1 | tail -30
```

Expected: All escalation-related tests pass (may have pre-existing demand/outcome failures)

### Step 2: Verify model output format

```bash
cd inuka-pipeline && python3 -c "
import json
with open('data/warehouse/inuka_predictions_export.json') as f:
    predictions = json.load(f)
sample = predictions[0] if predictions else {}
print('Sample prediction keys:', list(sample.keys()))
print('Has beneficiary_id:', 'beneficiary_id' in sample)
print('Has dropout_prob:', 'dropout_prob' in sample)
print('Has top_features:', 'top_features' in sample)
"
```

### Step 3: Verify live bridge output

```bash
cd inuka-pipeline && python -m src.inuka_live_bridge 2>&1 | tail -10
python3 -c "
import json
with open('data/warehouse/live_batch.json') as f:
    batch = json.load(f)
if batch['incidents']:
    inc = batch['incidents'][0]
    print('First incident beneficiary_id:', inc.get('beneficiary_id'))
    print('First incident_id:', inc.get('incident_id'))
else:
    print('No incidents in batch')
"
```

### Step 4: Verify backend compiles

```bash
cd inuka-pulse-backend && ./mvnw compile -q && echo "Backend: PASS" || echo "Backend: FAIL"
```

### Step 5: Verify new backend files exist

```bash
ls -la inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/Prediction*.java
ls -la inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/RiskDriverDto.java
ls -la inuka-pulse-backend/src/main/resources/db/migration/V34__*.sql
ls -la inuka-pulse-backend/src/main/resources/db/migration/V35__*.sql
```

### Step 6: Verify frontend components exist

```bash
ls -la inuka-pulse-frontend/src/components/explainability-panel.tsx
ls -la inuka-pulse-frontend/src/components/prediction-feedback-widget.tsx
ls -la inuka-pulse-frontend/src/components/risk-band-badge.tsx
```

### Step 7: Run backtest report summary

```bash
cd inuka-pipeline && python3 -c "
import json
with open('data/warehouse/inuka_backtest_report.json') as f:
    report = json.load(f)
print('=== Model Backtest Report ===')
print(f\"Total samples: {report.get('total_samples')}\")
print(f\"Train rows: {report.get('train_samples')}\")
print(f\"Test rows: {report.get('test_samples')}\")
print(f\"Escalation rate (train): {report.get('escalation_rate_train', report.get('positive_rate_train'))}\")
print(f\"Escalation rate (test): {report.get('escalation_rate_test', report.get('positive_rate_test'))}\")
print(f\"ROC-AUC: {report.get('test_roc_auc')}\")
print(f\"F2 Score: {report.get('test_fbeta')}\")
print(f\"Optimal threshold: {report.get('optimal_threshold')}\")
"
```

### Step 8: Git log summary

```bash
cd /home/kariioke/IdeaProjects/Inuka-Pulse && git log --oneline fc504c77..HEAD | head -20
```

### Step 9: Create validation report

Write summary to progress.md with:
- All tests status
- Model metrics
- Component checklist
- Any remaining issues
