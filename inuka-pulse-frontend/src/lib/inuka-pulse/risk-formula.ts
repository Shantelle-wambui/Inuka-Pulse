/**
 * Frontend mirror of RiskService.java computeRiskScore().
 *
 * CRITICAL: This formula MUST match RiskService.java exactly.
 * If the Java formula changes, update this file in the same commit.
 *
 * Formula constants (must match Java):
 *   incidentCeiling : 2.0   (200 incidents = max sub-score)
 *   auditCeiling    : 1.8   (180 days = max sub-score)
 *   rejectionAmp    : 500.0 (amplifier — 20% rejection → max sub-score)
 *   spikeCeiling    : 10.0  (10 spikes = max sub-score)
 *   weights         : 0.30 / 0.30 / 0.20 / 0.10 / 0.10
 *
 * FORMULA SYNC TEST: Run `npm test -- risk-formula.sync.test.ts` to verify
 * this formula matches the Java implementation. See Task #3 remediation.
 */

import type { SeverityBand } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// ML Prediction Band Thresholds (synced from backend /api/ml/decision-threshold)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Default ML prediction band thresholds.
 * These are fallbacks when the backend endpoint is unavailable.
 *
 * IMPORTANT: These should match the Python pipeline's inuka_predict.py _band() function.
 * The actual thresholds are fetched dynamically via fetchDecisionThreshold().
 */
export const DEFAULT_ML_THRESHOLDS = {
  /** Dropout band: probability >= 0.70 (high confidence) */
  DROPOUT_MIN: 0.70,
  /** Default decision threshold (overridden by model's optimal threshold) */
  DECISION_THRESHOLD: 0.50,
  /** At-Risk band: probability >= threshold * 0.55 */
  AT_RISK_MULTIPLIER: 0.55,
} as const;

export type PredictionBand = "Active" | "At-Risk" | "Disengaged" | "Dropout";

/**
 * Determines the prediction band for a dropout probability.
 *
 * @param probability - Dropout probability (0.0 to 1.0)
 * @param threshold - Decision threshold from the model (defaults to 0.50)
 * @returns The prediction band label
 *
 * Band logic (mirrors inuka_predict.py _band()):
 *   - Dropout:    prob >= 0.70
 *   - Disengaged: prob >= threshold
 *   - At-Risk:    prob >= threshold * 0.55
 *   - Active:     prob < threshold * 0.55
 */
export function probabilityToBand(
  probability: number,
  threshold: number = DEFAULT_ML_THRESHOLDS.DECISION_THRESHOLD
): PredictionBand {
  if (probability >= DEFAULT_ML_THRESHOLDS.DROPOUT_MIN) return "Dropout";
  if (probability >= threshold) return "Disengaged";
  if (probability >= threshold * DEFAULT_ML_THRESHOLDS.AT_RISK_MULTIPLIER) return "At-Risk";
  return "Active";
}

/**
 * Returns a human-readable description of what a band means.
 *
 * @param band - The prediction band
 * @param threshold - Optional threshold for context
 */
export function getBandDescription(band: PredictionBand, threshold?: number): string {
  const t = threshold ?? DEFAULT_ML_THRESHOLDS.DECISION_THRESHOLD;
  switch (band) {
    case "Dropout":
      return `High-confidence dropout prediction (≥70%)`;
    case "Disengaged":
      return `Above decision threshold (≥${(t * 100).toFixed(0)}%)`;
    case "At-Risk":
      return `Early warning zone (≥${(t * DEFAULT_ML_THRESHOLDS.AT_RISK_MULTIPLIER * 100).toFixed(0)}%)`;
    case "Active":
      return `Below risk threshold (<${(t * DEFAULT_ML_THRESHOLDS.AT_RISK_MULTIPLIER * 100).toFixed(0)}%)`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Cohort Risk Score Formula (rule-weighted, not ML)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Formula constants for the rule-weighted risk score.
 * CRITICAL: These MUST match RiskService.java exactly.
 *
 * To verify sync, run: npm test -- risk-formula.sync.test.ts
 */
export const RISK_FORMULA_CONSTANTS = {
  /** Incident count ceiling: 200 incidents = 100 sub-score points */
  INCIDENT_CEILING: 2.0,
  /** Audit recency ceiling: 180 days = 100 sub-score points */
  AUDIT_CEILING: 1.8,
  /** Rejection rate amplifier: 20% rejection = 100 sub-score points */
  REJECTION_AMP: 500.0,
  /** Pressure spikes ceiling: 10 spikes = 100 sub-score points */
  SPIKE_CEILING: 10.0,
  /** Component weights (must sum to 1.0) */
  WEIGHTS: {
    INCIDENT_FREQUENCY: 0.30,
    SEVERITY_MIX: 0.30,
    AUDIT_RECENCY: 0.20,
    REJECTION_RATE: 0.10,
    PRESSURE_SPIKES: 0.10,
  },
  /** Band thresholds (score 0-100) */
  BANDS: {
    CRITICAL: 75,
    HIGH: 55,
    MEDIUM: 30,
  },
} as const;

export interface RiskContribs {
  incidentFrequency: number; // weighted pts, max 30
  severityMix: number;       // weighted pts, max 30
  auditRecency: number;      // weighted pts, max 20
  rejectionRate: number;     // weighted pts, max 10
  pressureSpikes: number;    // weighted pts, max 10
}

export interface RiskScoreResult {
  score: number;
  band: SeverityBand;
  contribs: RiskContribs;
}

export function scoreToBand(score: number): SeverityBand {
  if (score >= 75) return "Critical";
  if (score >= 55) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

/**
 * Computes the composite risk score and per-factor weighted contributions.
 *
 * @param incidentCount  - total incident count for the site
 * @param critHighCount  - number of Critical or High severity incidents
 * @param daysSinceAudit - calendar days since last audit (365 if never audited)
 * @param rejectedRate   - fraction of records rejected (0.0 to 1.0)
 * @param pressureSpikes - count of out-of-range pressure readings
 */
export function computeRiskScore(
  incidentCount: number,
  critHighCount: number,
  daysSinceAudit: number,
  rejectedRate: number,
  pressureSpikes: number,
): RiskScoreResult {
  const incidentSub  = Math.min(incidentCount / 2.0, 100);
  const severitySub  = incidentCount > 0
    ? Math.min((critHighCount / incidentCount) * 100, 100) : 0;
  const auditSub     = Math.min(daysSinceAudit / 1.8, 100);
  const rejectionSub = Math.min(rejectedRate * 500, 100);
  const spikeSub     = Math.min(pressureSpikes * 10, 100);

  const contribs: RiskContribs = {
    incidentFrequency: Math.round(incidentSub  * 0.30 * 100) / 100,
    severityMix:       Math.round(severitySub  * 0.30 * 100) / 100,
    auditRecency:      Math.round(auditSub     * 0.20 * 100) / 100,
    rejectionRate:     Math.round(rejectionSub * 0.10 * 100) / 100,
    pressureSpikes:    Math.round(spikeSub     * 0.10 * 100) / 100,
  };

  const raw = contribs.incidentFrequency + contribs.severityMix +
              contribs.auditRecency + contribs.rejectionRate + contribs.pressureSpikes;

  const score = Math.min(Math.max(Math.round(raw), 0), 100);

  return { score, band: scoreToBand(score), contribs };
}
