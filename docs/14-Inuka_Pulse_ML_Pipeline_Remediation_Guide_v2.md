# 14 — Inuka Pulse ML Pipeline Remediation Guide (v2)
## From Data Generation to Frontend Presentation, and How Each Fix Threads Through Docs 12/13

> **Supersedes** the original `Inuka_Pulse_ML_Pipeline_Remediation_Guide.md`. Every diagnosis in that document was re-verified line-by-line against `Shantelle-wambui/Inuka-Pulse`, `development` branch, on 2026-08-24 — all eight are still live in the repo as written (confirmed file/line references below). This version keeps the original's phase structure intact (it's correct) and adds the one thing it was missing: **how each fix connects to the location hierarchy, Case Manager role, Contact & Follow-up Log, Engagement Score, and Welfare Concern work defined in docs 12 and 13.** Those two documents describe the target architecture; this document is the concrete, file-by-file path to get the ML pipeline into a state that architecture can actually sit on top of.
>
> **Read this alongside:**
> - Doc 12 (`12-gap-analysis-and-mvp-solution-architecture.md`) — location hierarchy (§3), Engagement Score / Contact Log / Welfare Concern scope (§4.3), MVP tiers (§4.1)
> - Doc 13 (`13-systems-design-sitemap-modules-process-flows.md`) — sitemap, module map, the two process-flow diagrams this remediation feeds directly into

---

## 0. The problem, in one paragraph, and why it's a prerequisite to docs 12/13

The system was built as a domain transplant from an HSE/pipeline-monitoring platform (Sentinel) onto a beneficiary-services domain (Inuka Pulse). Most of the transplant succeeded structurally, but four specific breaks sit *underneath* every screen doc 13's sitemap describes: the synthetic data has no time-varying signal to predict from, the label can't produce a genuine forecast because of that, a field-name mismatch silently drops every ML prediction before it reaches the database, and beneficiary identity is lost by the time a prediction becomes a case a Case Manager can act on. **None of docs 12/13's new surfaces — My Caseload, Engagement Score, Contact & Follow-up Log, the HITL review queues — have anything real to display until these eight defects are fixed.** This is why this guide is a prerequisite document, not a parallel workstream: doc 12 §2.2's "Grace" loop (`missed sessions → ETL detects → Model 1 flags → HITL → Case Manager outreach → closure → next week's training row`) is currently broken at three separate links before it ever reaches a Case Manager's screen.

Work the phases in order. Each assumes the previous is done. Phase 1.5 (§2A) is a late addition to this v2 — the original guide didn't budget for training-set size, and the pipeline as originally fixed still only yields on the order of 1,000 usable training rows after label censoring, which isn't enough to trust the metrics the later phases depend on. It sits between Phase 1 and Phase 2 because it changes the same generator constants Phase 1 touches, and Phase 2's label logic should be validated against production-scale volume, not a small sample that gets swapped out later.

---

## 1. Where each phase lands in the doc 12/13 architecture

Before the phase-by-phase detail, the map of "this fix enables that downstream feature" — the connective tissue the original guide didn't spell out:

| Phase | Fixes | Downstream doc 12/13 feature it unblocks |
|---|---|---|
| 1 — Data generator | Static status → real weekly trajectories | Doc 12 §4.3 priority 2 (Engagement Score) and priority 5 (Assessment Score Trends) need genuine within-beneficiary movement to mean anything — a flat trajectory makes both a constant number |
| 1.5 — Scale the dataset | ~1,000 usable rows → 10,000+ usable rows | Every metric in Phase 3's sanity check, every confidence band doc 13's HITL flow relies on, and the Engagement Score's calibration all depend on the underlying model being trained on enough data to be trustworthy, not just technically fittable |
| 2 — Label definition | Current-state classifier → 30-day escalation forecast | Doc 13's Process Flow §4 confidence-check/HITL branches assume Model 1 is forecasting, not reporting current status — a current-state label makes the whole HITL step redundant (nothing to "catch early") |
| 3 — Retrain/sanity-check | Confirms the model learned real signal, not a generator artifact | Doc 12 §4.3 priority 1 ("Dropout Risk Model") stays the anchor only if it's actually predictive; this phase is the gate that earns that claim |
| 4 — ETL bridge field-name fix | `fact_predictions` populated at all | Doc 13 §5's entire "one shared data path" principle (`fact_predictions` is the only thing the dashboard reads) is currently vacuous — the table is empty |
| 5 — Beneficiary-granularity gap | `beneficiary_id` threaded through incidents/alerts/CAPA | This *is* the backend half of doc 13's `caseload-app`/`contact` package — My Caseload cannot exist if a case can't be traced to a beneficiary |
| 6 — Interpretation layer | One honest, centralized `PredictionView` | Feeds doc 13's `RiskBadge`/`ExplainabilityPanel` everywhere a prediction renders, including the Command Center KPI strip and My Caseload |
| 7 — Frontend components | Shared `RiskBadge`, `ExplainabilityPanel`, `PredictionFeedbackWidget` | Directly the components doc 13's sitemap references under Field Operations, Early Warning, and ML/Intelligence |
| 8 — E2E validation | Proves the loop closes | Validates doc 12 §2.2's Grace narrative and doc 13 §4's process-flow diagram end to end, not just phase by phase |

Two things doc 12/13 ask for that are **not** phases in this guide because they're pure additive scope, not fixes to broken code — flagged here so nothing gets silently dropped:

- **Location hierarchy (doc 12 §3):** `inuka_predict.py`'s export currently carries `county` (verified: `["beneficiary_id", "cohort_id", "pillar", "county", "as_of_date", "dropout_prob", "top_features"]`). Migrating this to `location_id` is a doc 12 schema change, independent of the fixes below — see §9.
- **Engagement Score / Contact Log / Welfare Concern (doc 12 §4.3):** these are new build, not remediation. §9 notes exactly where each one plugs into the phases below so they aren't built against pre-fix data and get the same defects baked in.

---

## 2. Phase 1 — Fix the data generator so a forecast is possible at all

**File:** `inuka-pipeline/src/generate_inuka_data.py`

### What's wrong (verified against repo, `development` branch)

`build_beneficiaries()` (line ~235) assigns `current_status` **once**, as a single random weighted draw per beneficiary, permanently fixed for the entire simulated window:

```python
status = random.choices(ENGAGEMENT_LEVELS, weights=[...])[0]
```

`build_sessions()` (line ~288) then generates weekly attendance using a **constant** probability derived from that one static status — the same probability every week, for every beneficiary, from enrollment to exit:

```python
base_attend = 0.55 if is_high_risk else 0.82
if ben["current_status"] == "Disengaged":
    base_attend *= 0.5
elif ben["current_status"] == "At-Risk":
    base_attend *= 0.7
```

Only `Dropout` beneficiaries get a `dropout_date`, drawn uniformly at random, unrelated to any change in behavior beforehand. Attendance stays flat right up to that date, then the beneficiary's records simply stop. `build_field_visits()` (line ~342) has the same static-status branch.

### Why this matters

- **"Predict the band 30 days from now" has nothing to learn from.** Every week's true label for a given beneficiary is identical to every other week's, by construction. This is a data problem, not a modeling problem — no amount of label-formula cleverness in Phase 2 fixes it if this isn't fixed first.
- **There is no lead-up to dropout represented.** The product's entire premise — catching disengagement before it becomes a dropout — isn't in the synthetic data. A soon-to-drop beneficiary looks behaviorally identical in week 1 and week 25.
- **A secondary leak:** `build_assessments()` skips beneficiaries entirely once `current_status == "Dropout"`, so `assessment_score_latest` is `NaN` for 100% of the group the model is trying to predict. A model can hit strong-looking metrics by learning "missing assessment score → positive label," a generation-code artifact, not real signal.

### The fix

Replace the single static `current_status` with a **per-beneficiary weekly state trajectory** — a sequence of `(week, band)` pairs with realistic dwell times.

**Step 1.1 — Generate a trajectory instead of a single status**

```python
TRAJECTORY_TYPES = ["stable_active", "gradual_decline", "sudden_dropout",
                     "chronic_at_risk", "recovering"]

def build_trajectory(is_high_risk: bool, n_weeks: int = 26) -> list[str]:
    weights = ([0.35, 0.35, 0.15, 0.10, 0.05] if is_high_risk
               else [0.65, 0.15, 0.05, 0.10, 0.05])
    ttype = random.choices(TRAJECTORY_TYPES, weights=weights)[0]
    band_order = ["Active", "At-Risk", "Disengaged", "Dropout"]

    if ttype == "stable_active":
        return ["Active"] * n_weeks
    if ttype == "chronic_at_risk":
        settle = random.randint(3, 6)
        return ["Active"] * settle + ["At-Risk"] * (n_weeks - settle)
    if ttype == "recovering":
        d1, d2 = random.randint(3, 6), random.randint(3, 6)
        return ["Active"] * d1 + ["At-Risk"] * d2 + ["Active"] * (n_weeks - d1 - d2)
    if ttype == "sudden_dropout":
        pre = n_weeks - random.randint(2, 3)
        return ["Active"] * pre + ["At-Risk"] * (n_weeks - pre - 1) + ["Dropout"]
    if ttype == "gradual_decline":
        dwell = [random.randint(4, 8), random.randint(3, 6), random.randint(2, 4)]
        bands, cursor = [], 0
        for band, d in zip(band_order[:3], dwell):
            bands += [band] * d
            cursor += d
            if cursor >= n_weeks:
                return bands[:n_weeks]
        bands += ["Dropout"] * (n_weeks - len(bands))
        return bands[:n_weeks]
```

`current_status` in `dim_beneficiary.csv` becomes `trajectory[-1]` (status as of today) — nothing else reading that field needs to change.

**Step 1.2 — Persist the trajectory as ground truth**

New output file `fact_engagement_history.csv` (`beneficiary_id, week_start, band`) — this is the ground-truth table Phase 2's label gets built from, and it doubles as the raw material for doc 12 §4.3 priority 2's Engagement Score once it exists (see §9.2).

**Step 1.3 — Drive attendance, visits, assessments from the week's actual band**

Replace the constant `base_attend` in `build_sessions()` with a lookup against that week's trajectory band. Remove the blanket `if current_status == "Dropout": continue` in `build_assessments()` — generate assessments up through whichever week the beneficiary was still engaged, closing the leak.

**Step 1.4 — Add a short decay window at each transition**

Ramp attendance down over the 1–2 weeks before a band transition rather than switching instantly. This is what gives a 30-day-ahead model an actual leading indicator to detect.

### Validation before moving to Phase 2

- `fact_engagement_history.csv` shows genuine within-beneficiary band variation over time.
- Trajectory-type distribution roughly matches the weights; a `gradual_decline` beneficiary's weekly attendance visibly declines before the band changes.
- `assessment_score_latest` is no longer `NaN` for every eventual-dropout beneficiary.

---

## 2A. Phase 1.5 — Scale the dataset: ~1,000 usable training rows isn't enough

### What's wrong

Verified against the repo's own constants: `PILLARS` has 4 entries, `COUNTIES` has 5, so `build_cohorts()` produces exactly **20 cohorts**. `build_beneficiaries()` draws `random.randint(70, 110)` per high-risk cohort and `random.randint(90, 130)` per normal cohort — roughly **2,000 beneficiaries total**, matching the file's own comment (`# 2. dim_beneficiary — ~2 000 beneficiaries`). `build_features()` defaults to `days_back=180` on a `freq="W-MON"` weekly cadence, i.e. **~26 weekly snapshots per beneficiary**.

On paper that's ~2,000 × 26 ≈ 52,000 raw (beneficiary, week) snapshot rows — plenty. But Phase 2's `build_escalation_labels()` throws most of that away before it ever reaches training:

- **Right-censoring** drops every row whose `as_of_date + 30 days` falls past the observed window — the last ~4–5 of the 26 weeks *for every beneficiary*, roughly 15–20% of rows gone immediately.
- **`band_now == "Dropout"` rows are dropped entirely** (no worse state to escalate to) — for high-risk cohorts running `sudden_dropout`/`gradual_decline` trajectories, a meaningful share of a beneficiary's late-window rows fall in this band and are removed.
- The 67/33 time-based train/test split (Phase 2, Step 2.3) then divides whatever survives, and only the **train** side trains the model.

Run those three reductions against a base of ~2,000 beneficiaries and the *usable, labeled, in-training-split* row count lands in the low thousands — consistent with the ~1,000-row training set actually being observed. This isn't a bug in Phase 2's logic (the censoring is correct and necessary — see Phase 2 above), it's a volume problem one level upstream: **the generator isn't producing enough beneficiaries and weeks to survive the filtering a genuine forecast label requires.**

### Why 1,000 rows is a real problem, not just a nice-to-have fix

A `LogisticRegression` baseline (Phase 3) with `class_weight="balanced"` can technically fit on a few hundred rows, but at ~1,000 rows split 67/33, the test slice is only ~300–350 rows — too small for the backtest metrics in `inuka_backtest_report.json` (precision/recall/F1) to be stable, and too small for the feature-importance sanity check in Phase 3 (Step 3) to reliably distinguish "the model is leaning on `band_now`" from "the model has too little data to learn anything else." It also directly undermines doc 12 §4.3's Engagement Score and doc 13's HITL confidence-banding — both assume the underlying model's probabilities are well-calibrated, which a few-hundred-row test set can't establish with confidence. **10,000+ usable training rows is the floor for treating any of the metrics downstream of this model as trustworthy**, not an arbitrary target.

### The fix — scale three independent levers, not just one

Don't just crank beneficiary count — the three levers below are independent and it's cheaper to move all three a moderate amount than to push one lever to an extreme (e.g., 20,000 beneficiaries with only 8 weeks of history still doesn't fix the censoring loss, and 200 weeks of history for 500 beneficiaries doesn't give the model behavioral diversity across cohorts).

**Step 1.5.1 — Increase beneficiary count per cohort**

```python
# generate_inuka_data.py, build_beneficiaries()
n = random.randint(220, 320) if is_high_risk else random.randint(260, 380)
```

This alone takes ~2,000 beneficiaries to ~6,000 (20 cohorts × ~300 avg) — roughly 3x, without adding cohorts or changing the geography/pillar structure doc 12 §3 is about to refactor anyway (no point growing the cohort count right before the location hierarchy migration touches the same tables).

**Step 1.5.2 — Extend the simulated window**

```python
# generate_inuka_data.py
START = TODAY - timedelta(days=364)   # 12-month window, was 180 (6 months)
```

```python
# inuka_features.py
def build_features(days_back: int = 364) -> pd.DataFrame:   # was 180
```

Doubling the window to ~52 weeks does two things at once: it roughly doubles the raw snapshot count per beneficiary, *and* it gives `gradual_decline` and `chronic_at_risk` trajectories (Phase 1, Step 1.1) more room to play out realistically — a 26-week window forces multi-stage declines to be compressed, which was already a soft constraint worth relaxing independent of the row-count problem.

**Step 1.5.3 — Recompute expected yield before regenerating**

With Step 1.5.1 + 1.5.2: ~6,000 beneficiaries × ~52 weeks ≈ 312,000 raw snapshot rows. After censoring (~4–5 weeks lost per beneficiary at the tail, a smaller *proportion* of a 52-week window than of a 26-week one — roughly 8–10% now, not 15–20%) and after dropping `band_now == "Dropout"` rows (roughly 8–12% of rows, cohort-dependent), expect **~250,000–260,000 labeled rows** before the train/test split, and **~165,000–175,000** in the 67% training slice. That's well past the 10,000-row floor with enough headroom that a future increase to the label's positive-rate target (Phase 2 validation: 15–30% positive) or a stricter censoring rule won't push it back below threshold.

**Step 1.5.4 — Don't scale blind — validate the yield, not just the generator**

Add a row-count assertion to the Phase 2 validation step rather than trusting the arithmetic above in production:

```python
# at the end of inuka_predict.py's label-building step
n_train = len(train_df)
assert n_train >= 10_000, (
    f"Training set has only {n_train:,} rows after censoring — "
    f"regenerate with more beneficiaries or a longer window (see Phase 1.5)."
)
print(f"Training rows: {n_train:,} | Test rows: {len(test_df):,}")
```

This turns "did we generate enough data" from something discovered by eyeballing `inuka_backtest_report.json` after the fact into a hard gate the pipeline itself enforces before training proceeds.

### Sequencing note

Do this **as part of Phase 1**, before Phase 2's label logic is written against the data — regenerating a second time after Phase 2 is already built just means re-running the same validation twice. If Phase 1 and Phase 2 are being done by different people in parallel, land Step 1.5.1–1.5.2 first so Phase 2 is developed and sanity-checked against production-scale volume from the start, not against a 2,000-beneficiary sample that then gets swapped out later.

### Validation before moving to Phase 2

- Regenerated `dim_beneficiary.csv` has ≥6,000 rows.
- Regenerated `fact_engagement_history.csv` spans ~52 weeks per beneficiary, not ~26.
- All Phase 1 validation checks (band variation, trajectory-weight distribution, no `NaN` assessment scores for dropouts) still pass at the new scale — a bigger dataset with the same generator bugs is not a fix.

---

## 3. Phase 2 — Fix the label so the model predicts forward, not sideways

**Files:** `inuka-pipeline/src/inuka_features.py`, `inuka-pipeline/src/inuka_predict.py`

### What's wrong (verified)

`inuka_features.py` builds one snapshot row per (beneficiary, week) — correct and reusable as-is. But `inuka_predict.py`'s `build_labels()` (line ~87) attaches the label by mapping the single static `current_status` onto **every** one of a beneficiary's ~26 weekly rows:

```python
HIGH_RISK_STATUSES = {"Dropout", "Disengaged"}
...
row["beneficiary_id"]: (1 if row["current_status"] in HIGH_RISK_STATUSES else 0)
```

The module docstring itself says the label is `"status-based: 1 if current_status in {Dropout, Disengaged}, 0 otherwise"` — this is a **current-state classifier**, not a forecast. The comments in-repo note a genuinely forward-looking 30-day window previously produced under 1% positives against the old static data — true before Phase 1, no longer true after it.

### Why this matters

Doc 13's Process Flow §4 (`C1{Confidence check}` → HITL review → case assignment) is built on the assumption that Model 1 is telling a Field Coordinator/Case Manager something they don't already know — "this person is *going to* escalate." A current-state label just restates what `current_status` already says, making the entire HITL/alert loop a more expensive way to display a field that already exists.

### The fix

**Step 2.1 — Add `band_now` as an input feature** in `inuka_features.py`, looked up from `fact_engagement_history.csv`. Escalation risk from Active is a different problem than escalation risk from Disengaged.

**Step 2.2 — Replace `build_labels()`** with an escalation label:

```python
BAND_ORDER = {"Active": 0, "At-Risk": 1, "Disengaged": 2, "Dropout": 3}

def build_escalation_labels(features: pd.DataFrame, history: pd.DataFrame) -> pd.DataFrame:
    """
    label = 1 if band 30 days later is strictly worse than band_now
    label = 0 if band 30 days later is the same or better
    Rows where band_now == 'Dropout' are dropped (no worse state to escalate to).
    Rows where t+30 falls past the observed window are dropped (right-censored).
    """
    history_idx = history.set_index(["beneficiary_id", "week_start"])["band"]
    rows = []
    for _, row in features.iterrows():
        if row["band_now"] == "Dropout":
            continue
        later_date = row["as_of_date"] + timedelta(days=30)
        try:
            band_later = history_idx.loc[(row["beneficiary_id"], later_date)]
        except KeyError:
            continue  # censored — outcome not observed, drop from training
        label = int(BAND_ORDER[band_later] > BAND_ORDER[row["band_now"]])
        rows.append({**row.to_dict(), "escalation_label": label})
    return pd.DataFrame(rows)
```

**Step 2.3 — Evaluation split unchanged.** The existing time-based 67/33 split stays as-is. The last 30 days of the window will correctly have no trainable rows — that mirrors production use (score the most recent week without knowing its future yet), not a bug.

### Validation before moving to Phase 3

- Positive rate in the 15–30% range is healthy for a 30-day escalation window. Under 2% → Phase 1's trajectories aren't varied enough. Over 50% → trajectory weights too aggressive.
- Labels vary *within* a single beneficiary's own weekly rows — the direct proof Phases 1+2 fixed the core problem together.

---

## 4. Phase 3 — Retrain and sanity-check the model

**File:** `inuka-pipeline/src/inuka_predict.py`

### Why this phase exists separately

Fixing the data and label doesn't guarantee the model learned something real. It's possible to fit an artifact of the generator instead — e.g., leaning entirely on `band_now` and ignoring behavioral features, which would mean the model learned the trajectory transition rules written in Phase 1 rather than anything about attendance/visits/scores. This phase catches that before doc 12 §4.3 priority 1 ("Dropout Risk Model, anchor model, unchanged") can honestly claim the anchor is trustworthy.

### Steps

1. Retrain: `python -m src.inuka_predict --train`, same `LogisticRegression(class_weight="balanced", C=0.5)` baseline — only the data changes, not the algorithm. Confirm the training-row assertion from Phase 1.5, Step 1.5.4 passes (≥10,000 rows) before trusting anything downstream of this run.
2. Check `inuka_backtest_report.json` — precision/recall/F1 on the held-out time slice. At the Phase 1.5 scale (~165,000+ training rows, ~80,000+ test rows) these numbers are statistically meaningful in a way they weren't at ~1,000 rows; treat any pre-Phase-1.5 backtest report as provisional and re-run after scaling.
3. Check `inuka_feature_importance.json`: `band_now` should matter, but `attendance_rate_30d`, `field_visit_gap_days`, `missed_sessions_14d` should carry real weight too. If `band_now` dominates completely, loosen the coupling between band and attendance decay in Phase 1, or add noise to trajectory dwell times.
4. Update `label_definition` and `label_rationale` in the backtest report to describe the escalation label honestly — this file is what future documentation or an audit will cite.

---

## 5. Phase 4 — Fix the broken ETL bridge (field-name mismatch)

**Files:** `inuka-pipeline/src/inuka_predict.py`, `inuka-pulse-backend/.../etl/EtlReloadService.java`

### What's wrong (verified against repo)

`inuka_predict.py` exports (confirmed, line ~254):

```python
export.columns → ["beneficiary_id", "cohort_id", "pillar", "county",
                   "as_of_date", "dropout_prob", "top_features"]
```

`EtlReloadService.loadPredictions()` (confirmed, line ~314 onward) reads different keys entirely — unmodified leftover code from the original KPC/Sentinel schema:

```java
String siteId = normaliseSiteId(str(r, "site_id"));   // line 329 — never present → always null
if (siteId == null || siteId.isBlank()) continue;      // → every row skipped

Object probObj = r.get("incident_probability_7d");     // line 336 — never present
if (probObj == null) continue;
```

**Consequence:** `fact_predictions` (`PredictionEntity`) is never populated. Its only consumer, `PredictionService.getProbabilityBySite()`, feeds `RiskService`'s ML-blended risk score — the dashboard's rule-based risk score has been running with **zero ML signal**, silently. No exception is thrown; the loop inserts nothing every cycle.

### Why this matters to doc 13 specifically

Doc 13 §5's entire cross-cutting principle — "`fact_predictions` is the only thing the dashboard reads," the seam that lets a "dashboard team" and an "ML team" work independently — depends on that table actually being populated. Right now that architectural seam is real in design but empty in practice: the dashboard is reading a table with zero ML rows in it.

### The fix

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public int loadPredictions() {
    File jsonFile = new File(sentinelDir, "data/warehouse/inuka_predictions_export.json");
    if (!jsonFile.exists()) return 0;

    List<Map<String, Object>> records = objectMapper.readValue(jsonFile, List.class);
    int loaded = 0;
    for (Map<String, Object> r : records) {
        String cohortId = normaliseSiteId(str(r, "cohort_id"));   // was "site_id"
        if (cohortId == null || cohortId.isBlank()) continue;

        String dateStr = str(r, "as_of_date");
        LocalDate asOfDate = dateStr != null ? LocalDate.parse(dateStr) : null;
        if (asOfDate == null) continue;

        Object probObj = r.get("dropout_prob");                    // was "incident_probability_7d"
        if (probObj == null) continue;
        double prob = Double.parseDouble(probObj.toString());

        boolean exists = predictionRepository.findLatestBySiteId(cohortId)
                .map(p -> p.getAsOfDate().equals(asOfDate))
                .orElse(false);
        if (exists) continue;

        PredictionEntity e = new PredictionEntity();
        e.setSiteId(cohortId);
        e.setAsOfDate(asOfDate);
        e.setProbability(prob);
        e.setModelVersion(str(r, "model_version"));
        e.setTopFeatures(str(r, "top_features"));
        predictionRepository.save(e);
        loaded++;
    }
    return loaded;
}
```

**Granularity note:** `inuka_predictions_export.json` is beneficiary-level; `fact_predictions`/`PredictionEntity` is one row per (cohort, date) by design — `RiskService` wants a cohort-level probability to blend into its cohort-level rule-based score. Aggregate to cohort level (mean or max `dropout_prob` per cohort per `as_of_date`) in `inuka_predict.py`'s export step or in a small transform before `loadPredictions()` reads the file — don't force beneficiary-level rows into the cohort-scoped table.

### Validation

`SELECT COUNT(*) FROM fact_predictions` grows on each ETL cycle; `RiskService`'s cohort risk summaries show a non-null ML-derived component.

---

## 6. Phase 5 — Decide, and fix, the beneficiary-granularity gap

**Files:** `inuka-pipeline/src/inuka_live_bridge.py`, `IncidentEntity.java`, `AlertEntity.java`, `CapaEntity.java`

### What's wrong (verified against repo)

`inuka_live_bridge.py` converts each **beneficiary-level** prediction into a **cohort-scoped** incident (confirmed, line ~143):

```python
row.update({
    "incident_id": f"INC-{ben_id}-{today_tag}",
    "site": cohort,   # not the beneficiary
    ...
})
```

`IncidentEntity.java` has no `beneficiaryId` field at all — confirmed fields are `incidentId, siteId, latitude, longitude, incidentDate, severity, description, complianceScore, status, closedDate, decision, decisionReason, batchId, ingestionTimestamp`. `AlertEntity.java` likewise has no `beneficiaryId` — confirmed fields are `id, siteId, severity, status, title, description, rule, recordIds, createdAt, acknowledgedAt, acknowledgedBy, narrative, narrativeUpdatedAt, narrativeIncidentCount, requiredQualification`. `CapaEntity` links only to `sourceAlertId`. **By the time a case reaches the point where someone would be assigned, the specific beneficiary who triggered it is gone** — recoverable only by string-parsing `incident_id` (`INC-{ben_id}-{today_tag}`) or the free-text `description` field, which nothing currently does.

### Why this is the load-bearing fix for doc 12/13's Case Manager work

This is not a side issue — it is the backend precondition for the single biggest new surface docs 12/13 define. Doc 13's module map lists `contact` (Contact & Follow-up Log) as a **new** backend package and `caseload-app` as a **new** frontend module, both keyed on `owner_id = current_user` scoping (doc 12 §2.1) down to individual beneficiaries. None of that is buildable while `IncidentEntity`/`AlertEntity`/`CapaEntity` only carry `siteId`. My Caseload literally cannot render "who on my caseload needs me today" if the chain from prediction to case has already dropped who "who" is.

### The fix

**Step 5.1 — Add a `beneficiary_id` column, threaded through the chain**

```sql
ALTER TABLE incidents ADD COLUMN beneficiary_id VARCHAR(20);
ALTER TABLE alerts    ADD COLUMN beneficiary_id VARCHAR(20);  -- nullable: cluster-type alerts may span several
ALTER TABLE capa      ADD COLUMN beneficiary_id VARCHAR(20);
```

**Step 5.2 — Carry it through `inuka_live_bridge.py`**

```python
row.update({
    "incident_id": f"INC-{ben_id}-{today_tag}",
    "site": cohort,
    "beneficiary_id": ben_id,   # new — structured, not string-embedded
    ...
})
```

**Step 5.3 — Update `IncidentEntity`, `AlertEntity`, `CapaEntity` and their loaders.** Add the field to each entity/DTO; in `EtlReloadService.loadIncidents()`, read and persist `beneficiary_id` directly instead of leaving it buried in `description`.

**Step 5.4 — Update `AlertRulesEngine`'s clustering rules deliberately, per rule, not globally.** Some alert rules are genuinely cohort-level (e.g., a high rejection rate across a batch) and should stay cohort-scoped with `beneficiary_id = null`. Others — an individual beneficiary crossing a dropout-probability threshold — should carry that beneficiary's ID through to the alert and the resulting CAPA. This nullable-column decision is also the correct home for the Welfare Concern escalation doc 12 §2.1/§4.3 priority 8 describes: a welfare flag is inherently beneficiary-level and should follow the same `beneficiary_id`-populated path as a dropout alert, using the existing `concern_report`/Hazard Report mechanism with `report_type='welfare_concern'` — no new table, same routing pattern as `intervention` escalation.

### Validation

Create a test beneficiary prediction above the alert threshold, run it through the full pipeline, confirm the resulting CAPA record has a populated `beneficiary_id` — not just a cohort — before considering this phase done.

---

## 7. Phase 6 — Build the interpretation layer (business-logic layer)

**New file, suggested location:** `inuka-pulse-backend/src/main/java/com/inukapulse/ml/PredictionInterpretationService.java`

### What's wrong, and why it matters

Right now, wherever a prediction is displayed, whatever component renders it independently decides what the number means — what band it falls in, how confident to sound, what the narrative text says. There's no single place enforcing consistency, or (most importantly) enforcing **honesty about what the model actually predicts**, which changed materially in Phase 2.

### The fix

One service, called once per prediction, producing one stable shape:

```java
public record PredictionView(
    String beneficiaryId,
    String cohortId,
    String band,                 // Active / At-Risk / Disengaged / Dropout
    double probability,
    String confidence,           // "confident" | "low-confidence" | "uncertain"
    String narrative,             // pre-written, honest about escalation vs current-state
    List<FeatureDriver> topDrivers,
    String modelVersion,
    Instant scoredAt,
    String reviewStatus          // "unreviewed" | "human-confirmed" | "disputed"
) {}
```

**Narrative copy rule, directly following from Phase 2:** now that the label is genuinely forward-looking (escalation within 30 days), the narrative can honestly say *"predicted to escalate to [band] within 30 days."* Before Phase 2, this same sentence would have been false. Keep this rule documented next to the narrative-generation code so nobody reverts the copy without also reverting the label.

Confidence banding: predictions within ~0.05 of the nearest band boundary get `"low-confidence"`; predictions within ~0.05 of 0.5 probability generally get `"uncertain"` regardless of band, and should be prioritized in the HITL feedback queue.

**Where doc 12 §4.3's Engagement Score plugs in here:** the Engagement Score is a *separate* formula-based signal (see §9.2), not a `PredictionView` field — but it should render through the same interpretation-layer discipline this phase establishes: one place decides what a number means, everywhere it's shown, so a Case Manager isn't reconciling two independently-computed "how worried should I be" signals with inconsistent framing.

---

## 8. Phase 7 — Frontend presentation structure

**Files:** `inuka-pulse-frontend/src/components/` (new shared components), any page currently rendering predictions ad hoc

### What's wrong, and why it matters

Without a single component contract, different screens (cohort grid, alert detail, ML Admin compare page — and now, per doc 13's sitemap, My Caseload) can end up showing the same beneficiary's risk differently, because each one independently parses `PredictionDto`/raw JSON and applies its own logic.

### The fix

Build exactly three reusable components against the `PredictionView` contract from Phase 6, and use them everywhere a prediction appears:

- **`RiskBadge`** — band + confidence, one visual treatment system-wide. This is the component doc 13's Field Operations/My Caseload branch and Early Warning/Alerts branch both render.
- **`ExplainabilityPanel`** — renders `topDrivers` consistently in plain language (not raw feature names like `attendance_rate_30d`). Doc 12 §4.1 notes the baseline estimators for Models 3/4 need a simpler "top driver" heuristic rather than SHAP — this panel is where that distinction is handled once, not per-screen.
- **`PredictionFeedbackWidget`** — the rate-this-prediction control, writing to `model_feedback` with the actual rating vocabulary (`correct`/`incorrect`/`uncertain`), present on every screen a prediction renders, not just the ML Admin portal — this is also the mechanism that, alongside the Contact & Follow-up Log (doc 12 §4.3 priority 3), forms the labeled training pool for retraining (doc 13 §4's `Q[(model_feedback + Contact Log = labeled training pool)]`).

If two screens ever need to show a prediction differently, that's a sign the interpretation layer needs a new field (e.g., a `displayContext` flag), not a sign each screen should re-derive its own logic.

---

## 9. Where doc 12's additive scope plugs into this pipeline (not remediation, but sequenced against it)

These are **new build**, correctly scoped in doc 12 as separate from bug-fixing — but each has a specific dependency on a phase above, and building them before that phase lands means building against broken or absent data.

### 9.1 Location hierarchy (doc 12 §3) — depends on Phase 4

`inuka_predict.py`'s export currently carries a flat `county` string. Doc 12 §3.2's `location` table replaces every hardcoded geography column, including this one, with a `location_id` FK. **Sequencing note:** do this migration *after* Phase 4 (the ETL bridge fix), not before or during — Phase 4 is already touching the same export schema (`cohort_id`, `dropout_prob` field names) and the same `EtlReloadService.loadPredictions()` method. Bundling a schema-shape change (`county` → `location_id`) into the same patch as a field-name fix makes the Phase 4 fix harder to verify in isolation. Land Phase 4 first, confirm `fact_predictions` is populating correctly, then swap `county` for `location_id` in the export and the loader as a second, separately-verifiable change.

### 9.2 Engagement Score (doc 12 §4.3 priority 2) — depends on Phase 1

The Engagement Score is explicitly "a weighted combination of features already in the feature store — no new data, no new model, a formula like Model 5's." Those features (`attendance_rate_30d`, `days_since_last_contact`, `assessment_score_trend`, etc.) only carry real signal once Phase 1's trajectories are in place — computing an Engagement Score against the current static-status data would produce a number that, like the pre-Phase-1 dropout label, is constant per beneficiary and therefore not actually "engagement" in any time-varying sense. Build this after Phase 1, and it can be built in parallel with Phases 2–5 since it doesn't depend on the label or the ETL bridge.

### 9.3 Contact & Follow-up Log (doc 12 §4.3 priority 3) — depends on Phase 5

The `contact_log` table (`beneficiary_id, case_manager_id, contact_type, outcome_note, timestamp`) is only useful once a Case Manager can be handed a beneficiary-identified case to log a contact against. This is a direct, hard dependency on Phase 5 — building the Contact Log UI before Phase 5 lands means it has no real `beneficiary_id` to attach entries to from the ML side (manual/adhoc entries would still work, but the "flag → contact → closure" loop doc 12 §2.2 describes would remain broken).

### 9.4 Welfare Concern Tracking (doc 12 §4.3 priority 8) — depends on Phase 5

Covered in §6, Step 5.4 above — same `beneficiary_id`-populated pathway, same `concern_report` mechanism, `report_type='welfare_concern'`.

---

## 10. Phase 8 — End-to-end validation checklist

Work through this in order once all phases are deployed. This is the same checklist as the original guide, unchanged — it was already correct and doesn't need revision, only re-confirmation that it now also proves doc 12/13's downstream features have real data to sit on:

1. Regenerate data (`generate_inuka_data.py`, at Phase 1.5 scale) — confirm `fact_engagement_history.csv` shows real band movement per beneficiary across ~52 weeks, not ~26.
2. Rebuild features (`inuka_features.py`) — confirm `band_now` is populated and varies across a beneficiary's own weekly rows.
3. Rebuild labels and retrain (`inuka_predict.py`) — confirm the ≥10,000-row training-set assertion passes, positive rate is in a sane range, and `band_now` isn't the only feature carrying weight.
4. Run the live bridge (`inuka_live_bridge.py`) — confirm the export JSON carries `beneficiary_id` as a structured field into `live_batch.json`.
5. Let `EtlReloadService` poll — confirm `fact_predictions` row count increases, and confirm `incidents`/`alerts`/`capa` rows carry a populated `beneficiary_id` where the triggering rule was beneficiary-level.
6. Confirm `RiskService`'s cohort risk summary now includes a real ML-derived probability component (Phase 4's fix).
7. Open the frontend — confirm the same beneficiary's prediction reads identically (same band, same narrative, same drivers) on the cohort grid, the alert detail page, **the My Caseload screen**, and the ML Admin portal.
8. Submit feedback through `PredictionFeedbackWidget` on a non-admin screen — confirm it lands in `model_feedback` and is visible in the ML Admin feedback queue.
9. **(New)** Log a Contact & Follow-up entry against a beneficiary-identified case from My Caseload — confirm it lands alongside `model_feedback` as part of the labeled training pool (doc 13 §4's `Q` node).
10. **(New)** File a test Welfare Concern from a beneficiary detail screen — confirm it routes to Programme Director/Coordinator via the existing `concern_report` escalation path, with `beneficiary_id` populated, not just a cohort reference.

If every step in this list passes, the loop described in doc 12 §2.2 — concern → risk assessment → alert → intervention → verified closure → feedback → retraining — is genuinely closed, beneficiary-identifiable, location-hierarchy-aware, end to end.

---

## Appendix — Every defect found, verified location, and its fix

| # | Issue | Verified location | Why it matters | Fix |
|---|---|---|---|---|
| 1 | `current_status` is static, assigned once, never evolves | `generate_inuka_data.py` → `build_beneficiaries()` (~line 235) | No forward-looking signal is possible from this data at all | Phase 1: per-beneficiary weekly state trajectory |
| 2 | No decline pattern before dropout — attendance flat then cliff | `generate_inuka_data.py` → `build_sessions()` (~line 288) | The "early warning" premise isn't represented in the data | Phase 1: decay window at each trajectory transition |
| 3 | Assessments never generated for eventual-dropout beneficiaries | `generate_inuka_data.py` → `build_assessments()` | Model can learn a missingness artifact instead of real signal | Phase 1: generate assessments up to the decline point |
| 3b | Dataset yields only ~1,000 usable training rows after censoring | `generate_inuka_data.py` (`PILLARS`×`COUNTIES`→20 cohorts, ~2,000 beneficiaries, 180-day/~26-week window) ↔ `inuka_predict.py`'s censoring logic | Backtest metrics and confidence-band calibration aren't trustworthy on a low-thousands-row train/test split | Phase 1.5: scale beneficiaries (~6,000+) and window (~52 weeks) so ≥10,000 rows survive censoring, with a hard row-count assertion in the pipeline |
| 4 | Label = static current status merged onto every weekly row | `inuka_predict.py` → `build_labels()` (~line 87) | Predicts present state, not the future; every row per beneficiary has an identical label | Phase 2: escalation label (band_now vs band at t+30) |
| 5 | No `band_now` feature | `inuka_features.py` | Model can't condition escalation risk on current state | Phase 2: add band_now as an input |
| 6 | Field-name mismatch: Python writes `cohort_id`/`dropout_prob`, Java reads `site_id`/`incident_probability_7d` | `inuka_predict.py` (~line 254) ↔ `EtlReloadService.loadPredictions()` (~line 314–336) | `fact_predictions` is silently never populated; `RiskService` has been running with zero ML signal | Phase 4: patch the Java reader to the real field names |
| 7 | No `beneficiary_id` column anywhere in `incidents`/`alerts`/`capa` | `inuka_live_bridge.py` (~line 143), `IncidentEntity.java`, `AlertEntity.java`, `CapaEntity.java` | A case can never be traced back to the beneficiary who triggered it — blocks My Caseload entirely | Phase 5: thread beneficiary_id through the schema |
| 8 | No centralized interpretation layer | Distributed across frontend + backend | Inconsistent, potentially dishonest framing of what the model predicts | Phase 6: `PredictionInterpretationService` + `PredictionView` contract |
| 9 | No shared frontend components for predictions | `inuka-pulse-frontend` | Same beneficiary's risk can render differently on different screens, including the new My Caseload view | Phase 7: `RiskBadge`, `ExplainabilityPanel`, `PredictionFeedbackWidget` |

---

*End of document. v1 (original remediation guide) is superseded by this version; retain both for audit trail but treat this one as authoritative going forward.*
