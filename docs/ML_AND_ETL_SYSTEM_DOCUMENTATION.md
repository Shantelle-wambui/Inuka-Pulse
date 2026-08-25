# Inuka Pulse — ML & ETL System Documentation

> **Comprehensive technical documentation of the Machine Learning system, ETL pipeline, and Human-in-the-Loop (HITL) portal**

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [ETL Pipeline Architecture](#2-etl-pipeline-architecture)
3. [Machine Learning Model](#3-machine-learning-model)
4. [Human-in-the-Loop (HITL) Portal](#4-human-in-the-loop-hitl-portal)
5. [Data Flow & Integration](#5-data-flow--integration)
6. [Model Lifecycle Management](#6-model-lifecycle-management)
7. [Statistical Diagnostics](#7-statistical-diagnostics)
8. [API Reference](#8-api-reference)
9. [Configuration](#9-configuration)

---

## 1. System Overview

Inuka Pulse is a beneficiary monitoring and dropout risk prediction platform for the Inuka Foundation. The system combines:

- **Python ETL Pipeline** — Feature engineering, ML model training, and live data bridge
- **Spring Boot Backend** — REST APIs, data persistence, alert generation, and ML admin portal
- **Next.js Frontend** — Dashboard visualization and ML Admin HITL interface

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INUKA PULSE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │   Raw CSV Data  │────▶│  Python ETL     │────▶│  live_batch.json│       │
│  │  (dim_*, fact_*)│     │  Pipeline       │     │  (warehouse)    │       │
│  └─────────────────┘     └────────┬────────┘     └────────┬────────┘       │
│                                   │                       │                 │
│                                   ▼                       ▼                 │
│                          ┌─────────────────┐     ┌─────────────────┐       │
│                          │  ML Model       │     │  Spring Boot    │       │
│                          │  (logreg.pkl)   │────▶│  Backend        │       │
│                          └─────────────────┘     └────────┬────────┘       │
│                                                           │                 │
│                                                           ▼                 │
│                                                  ┌─────────────────┐       │
│                                                  │  PostgreSQL DB  │       │
│                                                  │  - fact_predictions    │
│                                                  │  - model_registry      │
│                                                  │  - model_feedback      │
│                                                  │  - alerts              │
│                                                  └────────┬────────┘       │
│                                                           │                 │
│                                                           ▼                 │
│                                                  ┌─────────────────┐       │
│                                                  │  Next.js        │       │
│                                                  │  Frontend       │       │
│                                                  │  (ML Admin HITL)│       │
│                                                  └─────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ETL Pipeline Architecture

### 2.1 Pipeline Components

The ETL pipeline (`inuka-pipeline/`) is a Python-based system that processes raw beneficiary data and produces ML-ready features.

#### Directory Structure

```
inuka-pipeline/
├── data/
│   ├── raw/inuka/           # Source CSV files
│   │   ├── dim_beneficiary.csv
│   │   ├── dim_cohort.csv
│   │   ├── fact_assessments.csv
│   │   ├── fact_disbursements.csv
│   │   ├── fact_field_visits.csv
│   │   └── fact_sessions.csv
│   └── warehouse/           # Processed outputs
│       ├── fact_beneficiary_features.parquet
│       ├── inuka_predictions_export.json
│       ├── live_batch.json
│       └── [diagnostic JSONs]
├── models/
│   └── inuka_logreg_v1.pkl  # Trained model artifact
└── src/
    ├── inuka_features.py    # Feature engineering
    ├── inuka_predict.py     # Model training & scoring
    ├── inuka_live_bridge.py # Backend integration bridge
    └── inuka_diagnostics.py # Statistical analysis
```

### 2.2 Feature Engineering (`inuka_features.py`)

Produces weekly feature snapshots per beneficiary with the following schema:

| Feature                    | Type  | Description                                         |
| -------------------------- | ----- | --------------------------------------------------- |
| `beneficiary_id`           | TEXT  | Unique beneficiary identifier                       |
| `cohort_id`                | TEXT  | Cohort membership                                   |
| `pillar`                   | TEXT  | Programme pillar (Scholarship/Plus/Vocational/Tech) |
| `county`                   | TEXT  | Geographic location                                 |
| `as_of_date`               | DATE  | Snapshot date                                       |
| `days_since_last_contact`  | INT   | Days since last field visit or session              |
| `sessions_attended_30d`    | INT   | Sessions attended in last 30 days                   |
| `sessions_total_30d`       | INT   | Total sessions scheduled in last 30 days            |
| `attendance_rate_30d`      | FLOAT | Attendance rate (0.0 - 1.0)                         |
| `missed_sessions_14d`      | INT   | Sessions missed in last 14 days                     |
| `disbursement_delay_days`  | FLOAT | Average disbursement delay (60d window)             |
| `missed_disbursements_60d` | INT   | Withheld/pending disbursements                      |
| `assessment_score_latest`  | FLOAT | Most recent assessment score                        |
| `assessment_score_trend`   | FLOAT | Score change (wave2 - wave1)                        |
| `field_visit_gap_days`     | INT   | Days since last field visit                         |
| `no_contact_visits_90d`    | INT   | "No Contact" visit outcomes in 90 days              |

**Usage:**

```bash
cd inuka-pipeline
python -m src.inuka_features --days-back 180
```

### 2.3 Live Bridge (`inuka_live_bridge.py`)

Converts ML predictions and field visit data into the `live_batch.json` format consumed by the Spring Boot backend.

**Mapping:**

- Predictions (dropout_prob ≥ 0.50) → Backend "incidents" (dropout risk alerts)
- Field visits (last 60 days) → Backend "audits" (field officer activity records)

**Severity Classification:**
| Probability | Severity |
|-------------|----------|
| ≥ 0.70 | Critical |
| ≥ 0.60 | High |
| ≥ 0.50 | Medium |

**Output Format:**

```json
{
  "batch_id": "uuid",
  "timestamp": "2026-08-22T04:00:00Z",
  "incidents": [...],
  "audits": [...],
  "summary": {
    "trusted": 150,
    "review": 10,
    "rejected": 0
  }
}
```

### 2.4 Live ETL Loop (`run_live.sh`)

Continuous ETL loop that runs the live bridge every 60 seconds:

```bash
./run_live.sh                    # Default 60s interval
INTERVAL=30 ./run_live.sh        # Custom interval
```

**Features:**

- Auto-activates Python virtual environment
- Log rotation at 10MB
- Graceful error handling (continues on failure)

---

## 3. Machine Learning Model

### 3.1 Model Architecture

**Algorithm:** Logistic Regression with balanced class weights

**Pipeline:**

```python
Pipeline([
    ("scaler", StandardScaler()),
    ("clf", LogisticRegression(
        class_weight="balanced",
        max_iter=1000,
        C=0.5,
        random_state=42
    ))
])
```

### 3.2 Label Definition

**Status-based labelling** (not forward-looking window):

| Current Status | Label        |
| -------------- | ------------ |
| Dropout        | 1 (Positive) |
| Disengaged     | 1 (Positive) |
| Active         | 0 (Negative) |
| At-Risk        | 0 (Negative) |

**Rationale:**

- Forward-looking 30-day window yields <1% positives across 56k snapshot rows
- Status-based labelling gives ~29% positives — well-calibrated for balanced LR
- This is documented in `inuka_backtest_report.json`

### 3.3 Training & Evaluation

**Time-based split (no data leakage):**

- Train: First 67% of rows (sorted by date)
- Test: Remaining 33% of rows

**Imputation Strategy:**
| Feature | Missing Value Handling |
|---------|------------------------|
| `field_visit_gap_days` | NULL/999 → 999 (never visited) |
| `days_since_last_contact` | NULL/999 → 999 |
| `assessment_score_latest` | NULL → cohort median, then global median |
| `assessment_score_trend` | NULL → 0 (no trend = neutral) |
| `attendance_rate_30d` | NULL → 0 (no sessions = worst case) |

**Usage:**

```bash
python -m src.inuka_predict --train   # Train new model
python -m src.inuka_predict --score   # Score only (requires pkl)
```

### 3.4 Prediction Output

**Engagement Band Mapping:**
| Probability | Band |
|-------------|------|
| ≥ 0.70 | Dropout |
| ≥ 0.45 | Disengaged |
| ≥ 0.25 | At-Risk |
| < 0.25 | Active |

**Top Features Explanation:**
Each prediction includes the top 3 risk drivers calculated from standardized coefficient contributions:

```
top_features: "attendance_rate_30d|days_since_last_contact|missed_sessions_14d"
```

### 3.5 Feature Importance

Stored in `inuka_feature_importance.json`:

```json
[
  {"feature": "attendance_rate_30d", "coefficient": -2.3451, "importance": 0.2841},
  {"feature": "days_since_last_contact", "coefficient": 1.8923, "importance": 0.2293},
  ...
]
```

---

## 4. Human-in-the-Loop (HITL) Portal

### 4.1 Portal Overview

The ML Admin HITL Portal enables programme managers and ML administrators to:

- Review model performance and predictions
- Provide human feedback on prediction accuracy
- Manage model lifecycle (champion/challenger promotion)
- Configure automated retraining schedules
- Monitor model drift

### 4.2 Core Components

#### 4.2.1 Model Registry

Tracks all trained models with their performance metrics:

```java
@Entity
@Table(name = "model_registry")
public class ModelRegistryEntity {
    private String id;
    private String version;
    private String algorithm;
    private LocalDateTime trainedAt;
    private BigDecimal precisionScore;
    private BigDecimal recallScore;
    private BigDecimal f1Score;
    private String status;           // champion | challenger | archived | rejected
    private String artifactPath;
    private Long approvedBy;
    private LocalDateTime approvedAt;
    private String featureImportance; // JSON blob
}
```

**Status Lifecycle:**

```
challenger → champion (promotion)
           → rejected (rejection)
           → archived (superseded)

champion → archived (new champion promoted)

archived → champion (rollback)
```

#### 4.2.2 Human Feedback System

Captures human labels for model predictions:

| Source         | Description                                    |
| -------------- | ---------------------------------------------- |
| `human_review` | Manual review via HITL portal                  |
| `capa_outcome` | Automatic label from closed CAPA interventions |

**Rating Values:**

- `correct` / `true_positive` — Model prediction was accurate
- `incorrect` / `false_positive` / `false_negative` — Model prediction was wrong
- `uncertain` — Reviewer cannot determine accuracy

**Feedback Recording:**

```java
// Automatic feedback from CAPA closure
@Service
public class ModelFeedbackService {
    @Transactional
    public void recordCapaOutcome(CapaEntity capa) {
        // When a CAPA is closed, automatically record as "accurate" feedback
        ModelFeedbackEntity fb = new ModelFeedbackEntity();
        fb.setSource("capa_outcome");
        fb.setRating("accurate");
        feedbackRepo.save(fb);
    }
}
```

#### 4.2.3 Predictions Review Queue

The portal surfaces uncertain predictions for human review:

```java
// Sort by uncertainty (closest to 0.5 = most uncertain)
preds.sort(Comparator.comparingDouble(p ->
    Math.abs(p.getProbability().doubleValue() - 0.5)));
```

**Confidence Bands:**
| Uncertainty | Band |
|-------------|------|
| < 0.10 | Uncertain (priority review) |
| < 0.20 | Low confidence |
| ≥ 0.20 | Confident |

### 4.3 Drift Detection

Daily scheduled job computes performance drift:

**Thresholds:**
| Condition | Status |
|-----------|--------|
| Baseline − Recent ≥ 10pp OR Recent < 70% | Critical |
| Baseline − Recent ≥ 5pp | Warning |
| Otherwise | Normal |

**Windows:**

- **Baseline:** First 30 feedback rows after promotion
- **Recent:** Most recent 30 feedback rows

```java
@Scheduled(cron = "0 0 3 * * *")  // Daily at 03:00
public void computeDailySnapshot() {
    // Compute accuracy for baseline and recent windows
    // Store performance snapshots for trend visualization
}
```

### 4.4 Model Comparison

Champion vs Challenger comparison includes:

1. **Metric Comparison:**
   - Precision delta
   - Recall delta
   - F1 delta

2. **Feature Importance Diff:**
   ```json
   [
     {
       "feature": "attendance_rate_30d",
       "championWeight": 0.284,
       "challengerWeight": 0.312,
       "delta": 0.028,
       "isNew": false
     }
   ]
   ```

### 4.5 Automated Retraining

**Schedule Configuration:**

```java
@Scheduled(cron = "0 0 2 * * SUN")  // Every Sunday at 02:00
public void runScheduledRetraining() {
    // Check feedback threshold (minimum 25 new rows)
    // Create challenger model
    // Status → "awaiting_review" (no auto-promotion)
}
```

**State Machine:**

```
disabled → scheduled → running → completed/failed → awaiting_review
```

**Key Principle:** Auto-promotion is NEVER done — human gate is always required.

---

## 5. Data Flow & Integration

### 5.1 Backend ETL Service

`EtlReloadService.java` handles:

1. **Auto-start on boot:**

   ```java
   @PostConstruct
   public void startEtlLoop() {
       // Launches run_live.sh in background
       ProcessBuilder pb = new ProcessBuilder("/bin/bash", "run_live.sh");
       etlProcess = pb.start();
   }
   ```

2. **Scheduled polling:**

   ```java
   @Scheduled(fixedDelayString = "${inuka.etl.poll-interval-ms:120000}")
   public void reload() {
       // Read live_batch.json
       // Load incidents, audits, predictions into PostgreSQL
       // Trigger alert rules engine
   }
   ```

3. **Data loading:**
   - Deduplication via existing ID checks
   - Site ID normalization (lowercase)
   - Automatic ingestion logging

### 5.2 Push Endpoint (CI/CD)

For GitHub Actions deployments:

```bash
curl -X POST https://api.inukapulse.org/api/etl/push \
  -H "X-ETL-Api-Key: $ETL_API_KEY" \
  -H "Content-Type: application/json" \
  -d @live_batch.json
```

### 5.3 Alert Generation

The `AlertRulesEngine` processes loaded incidents:

1. **Critical alerts** for high dropout probability
2. **EWMA breach alerts** from drift events
3. **Narrative generation** (optional LLM enhancement via Groq)

---

## 6. Model Lifecycle Management

### 6.1 Promotion Flow

```
1. Train new model (Python pipeline or scheduled retraining)
2. Model saved as "challenger" in model_registry
3. ML Admin reviews in HITL portal:
   - Compare metrics with champion
   - Review feature importance changes
   - Check drift status
4. ML Admin promotes challenger → champion
5. Previous champion → archived
```

### 6.2 Rollback Flow

```
1. Identify issue with current champion
2. ML Admin selects archived model
3. PATCH /api/ml/model-registry/{id}/rollback
4. Archived model → champion
5. Current champion → archived
```

### 6.3 Rejection Flow

```
1. ML Admin reviews challenger
2. Determines performance is worse
3. PATCH /api/ml/model-registry/{id}/reject
4. Challenger → rejected (with notes)
```

---

## 7. Statistical Diagnostics

### 7.1 Kaplan-Meier Retention Curves

**Purpose:** Compare beneficiary retention between all pillars and high-risk cohorts

**Output:** `inuka_survival_curve_data.json`

```json
{
  "series": [
    {
      "label": "All Pillars",
      "timeline": [1, 7, 14, ...],
      "survival": [1.0, 0.98, 0.95, ...],
      "median_days": 245
    },
    {
      "label": "High-Risk Cohorts",
      "median_days": 89
    }
  ],
  "headline": {
    "gap_ratio": 2.75,
    "interpretation": "High-risk cohort beneficiaries drop out 2.75× sooner..."
  }
}
```

### 7.2 EWMA Attendance Control Charts

**Purpose:** Early detection of cohort-level disengagement

**Parameters:**

- λ (smoothing) = 0.2
- L (control limit) = 3σ
- Baseline window = 8 weeks

**Output:** `inuka_control_chart_data.json` + `inuka_drift_events.json`

### 7.3 Correlation Analysis

**Purpose:** Quantify relationship between disbursement delays and dropout rates

**Output:** `inuka_correlation_data.json`

```json
{
  "pearson_r": 0.72,
  "p_value": 0.003,
  "interpretation": "Strong positive correlation: cohorts with longer payment delays have significantly higher dropout rates."
}
```

---

## 8. API Reference

### 8.1 ML Admin Endpoints

| Method | Endpoint                               | Description                 |
| ------ | -------------------------------------- | --------------------------- |
| GET    | `/api/ml/overview`                     | Champion/challenger summary |
| GET    | `/api/ml/model-registry`               | All registered models       |
| GET    | `/api/ml/training-runs`                | Training run history        |
| GET    | `/api/ml/feedback`                     | Human feedback records      |
| GET    | `/api/ml/predictions-for-review`       | Uncertain predictions queue |
| POST   | `/api/ml/feedback`                     | Submit human review         |
| POST   | `/api/ml/training-run`                 | Register new training run   |
| PATCH  | `/api/ml/model-registry/{id}/promote`  | Promote challenger          |
| PATCH  | `/api/ml/model-registry/{id}/reject`   | Reject challenger           |
| PATCH  | `/api/ml/model-registry/{id}/rollback` | Rollback to archived        |
| GET    | `/api/ml/drift`                        | Drift detection summary     |
| GET    | `/api/ml/models/compare`               | Champion vs challenger      |
| POST   | `/api/ml/retraining/schedule`          | Enable auto-retraining      |
| POST   | `/api/ml/retraining/disable`           | Disable auto-retraining     |
| GET    | `/api/ml/retraining/status`            | Current schedule status     |

### 8.2 ETL Endpoints

| Method | Endpoint          | Description           |
| ------ | ----------------- | --------------------- |
| GET    | `/api/etl/config` | ETL configuration     |
| POST   | `/api/etl/push`   | Receive batch (CI/CD) |

### 8.3 Prediction Endpoints

| Method | Endpoint                    | Description                 |
| ------ | --------------------------- | --------------------------- |
| GET    | `/api/predictions`          | Latest predictions per site |
| GET    | `/api/predictions/{siteId}` | Single site prediction      |

---

## 9. Configuration

### 9.1 Application Properties

```yaml
inuka:
  etl:
    enabled: true
    live-batch-path: ../inuka-pipeline/data/warehouse/live_batch.json
    pipeline-dir: ../inuka-pipeline
    poll-interval-ms: 120000 # 2 minutes
    rows-per-cycle: 200
    frontend-refresh-ms: 125000 # 2 min 5 sec
    api-key: ${ETL_API_KEY:}

  llm:
    groq-api-key: ${GROQ_API_KEY:}
    model: llama-3.1-8b-instant
    timeout-ms: 3000
    enabled: true
```

### 9.2 Environment Variables

| Variable              | Description                 | Default                                            |
| --------------------- | --------------------------- | -------------------------------------------------- |
| `ETL_ENABLED`         | Enable ETL auto-start       | `true`                                             |
| `ETL_LIVE_BATCH_PATH` | Path to live_batch.json     | `../inuka-pipeline/data/warehouse/live_batch.json` |
| `ETL_PIPELINE_DIR`    | Python pipeline root        | `../inuka-pipeline`                                |
| `ETL_API_KEY`         | API key for push endpoint   | (none)                                             |
| `GROQ_API_KEY`        | Groq API key for narratives | (optional)                                         |

### 9.3 Database Tables

| Table                        | Purpose                    |
| ---------------------------- | -------------------------- |
| `model_registry`             | Trained model metadata     |
| `training_run`               | Training execution records |
| `model_feedback`             | Human and automated labels |
| `model_performance_snapshot` | Drift detection data       |
| `retraining_schedule`        | Auto-retraining config     |
| `fact_predictions`           | ML predictions per site    |

---

## Summary

The Inuka Pulse ML system provides:

1. **Robust ETL Pipeline** — Automated feature engineering and data transformation
2. **Interpretable ML Model** — Logistic regression with explainable predictions
3. **Human-in-the-Loop Controls** — No automated model promotion; human gate required
4. **Comprehensive Monitoring** — Drift detection, performance tracking, and audit trails
5. **Statistical Diagnostics** — KM curves, EWMA charts, and correlation analysis
6. **Seamless Integration** — Live bridge connects Python ML to Java backend

The system is designed for transparency, auditability, and human oversight — critical requirements for a beneficiary welfare monitoring platform.
