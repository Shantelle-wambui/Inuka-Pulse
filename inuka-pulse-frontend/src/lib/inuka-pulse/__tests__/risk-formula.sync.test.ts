/**
 * Contract tests to verify the risk formula stays in sync with the backend.
 *
 * CRITICAL: If this test fails, the Java and TypeScript formulas have diverged.
 * Both files must be updated together:
 *   - Java:       RiskService.java computeRiskScore()
 *   - TypeScript: risk-formula.ts computeRiskScore()
 *
 * Run with: npx vitest run risk-formula.sync.test.ts
 * Or:       npm test -- risk-formula.sync.test.ts (if vitest is configured)
 *
 * NOTE: This file can be run with any test runner that supports describe/it/expect.
 * The tests are written to be framework-agnostic.
 */

import {
  computeRiskScore,
  scoreToBand,
  RISK_FORMULA_CONSTANTS,
} from "../risk-formula";

// ══════════════════════════════════════════════════════════════════════════════
// CONTRACT CONSTANTS — Must match RiskFormulaContractTest.java
// ══════════════════════════════════════════════════════════════════════════════

const CONTRACT = {
  INCIDENT_CEILING: 2.0,
  AUDIT_CEILING: 1.8,
  REJECTION_AMP: 500.0,
  SPIKE_CEILING: 10.0,
  WEIGHTS: {
    INCIDENT_FREQUENCY: 0.30,
    SEVERITY_MIX: 0.30,
    AUDIT_RECENCY: 0.20,
    REJECTION_RATE: 0.10,
    PRESSURE_SPIKES: 0.10,
  },
  BANDS: {
    CRITICAL: 75,
    HIGH: 55,
    MEDIUM: 30,
  },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// TEST CASES — Same as RiskFormulaContractTest.java
// ══════════════════════════════════════════════════════════════════════════════

interface TestCase {
  incidents: number;
  critHigh: number;
  days: number;
  rejection: number;
  spikes: number;
  expectedScore: number;
  expectedBand: string;
}

const CONTRACT_TEST_CASES: TestCase[] = [
  // Edge cases: all zeros
  { incidents: 0, critHigh: 0, days: 0, rejection: 0.0, spikes: 0, expectedScore: 0, expectedBand: "Low" },
  // Edge cases: all max
  { incidents: 200, critHigh: 200, days: 180, rejection: 0.20, spikes: 10, expectedScore: 100, expectedBand: "Critical" },
  // Single component max, others zero
  { incidents: 200, critHigh: 0, days: 0, rejection: 0.0, spikes: 0, expectedScore: 30, expectedBand: "Medium" },
  { incidents: 0, critHigh: 0, days: 180, rejection: 0.0, spikes: 0, expectedScore: 20, expectedBand: "Low" },
  { incidents: 0, critHigh: 0, days: 0, rejection: 0.20, spikes: 0, expectedScore: 10, expectedBand: "Low" },
  { incidents: 0, critHigh: 0, days: 0, rejection: 0.0, spikes: 10, expectedScore: 10, expectedBand: "Low" },
  // High severity mix
  { incidents: 100, critHigh: 100, days: 0, rejection: 0.0, spikes: 0, expectedScore: 45, expectedBand: "Medium" },
  // Realistic scenarios (recalculated with actual formula)
  { incidents: 50, critHigh: 25, days: 30, rejection: 0.05, spikes: 2, expectedScore: 30, expectedBand: "Medium" },
  { incidents: 100, critHigh: 80, days: 90, rejection: 0.10, spikes: 5, expectedScore: 59, expectedBand: "High" },
  { incidents: 150, critHigh: 120, days: 150, rejection: 0.15, spikes: 8, expectedScore: 79, expectedBand: "Critical" },
  // Boundary testing
  { incidents: 0, critHigh: 0, days: 54, rejection: 0.0, spikes: 0, expectedScore: 6, expectedBand: "Low" },
  { incidents: 0, critHigh: 0, days: 55, rejection: 0.0, spikes: 0, expectedScore: 6, expectedBand: "Low" },
];

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Risk Formula Contract Tests", () => {
  describe("Formula Constants Sync", () => {
    it("incident ceiling matches contract", () => {
      expect(RISK_FORMULA_CONSTANTS.INCIDENT_CEILING).toBe(CONTRACT.INCIDENT_CEILING);
    });

    it("audit ceiling matches contract", () => {
      expect(RISK_FORMULA_CONSTANTS.AUDIT_CEILING).toBe(CONTRACT.AUDIT_CEILING);
    });

    it("rejection amplifier matches contract", () => {
      expect(RISK_FORMULA_CONSTANTS.REJECTION_AMP).toBe(CONTRACT.REJECTION_AMP);
    });

    it("spike ceiling matches contract", () => {
      expect(RISK_FORMULA_CONSTANTS.SPIKE_CEILING).toBe(CONTRACT.SPIKE_CEILING);
    });

    it("weights match contract", () => {
      expect(RISK_FORMULA_CONSTANTS.WEIGHTS.INCIDENT_FREQUENCY).toBe(CONTRACT.WEIGHTS.INCIDENT_FREQUENCY);
      expect(RISK_FORMULA_CONSTANTS.WEIGHTS.SEVERITY_MIX).toBe(CONTRACT.WEIGHTS.SEVERITY_MIX);
      expect(RISK_FORMULA_CONSTANTS.WEIGHTS.AUDIT_RECENCY).toBe(CONTRACT.WEIGHTS.AUDIT_RECENCY);
      expect(RISK_FORMULA_CONSTANTS.WEIGHTS.REJECTION_RATE).toBe(CONTRACT.WEIGHTS.REJECTION_RATE);
      expect(RISK_FORMULA_CONSTANTS.WEIGHTS.PRESSURE_SPIKES).toBe(CONTRACT.WEIGHTS.PRESSURE_SPIKES);
    });

    it("weights sum to 1.0", () => {
      const sum = 
        RISK_FORMULA_CONSTANTS.WEIGHTS.INCIDENT_FREQUENCY +
        RISK_FORMULA_CONSTANTS.WEIGHTS.SEVERITY_MIX +
        RISK_FORMULA_CONSTANTS.WEIGHTS.AUDIT_RECENCY +
        RISK_FORMULA_CONSTANTS.WEIGHTS.REJECTION_RATE +
        RISK_FORMULA_CONSTANTS.WEIGHTS.PRESSURE_SPIKES;
      expect(sum).toBeCloseTo(1.0, 4);
    });

    it("band thresholds match contract", () => {
      expect(RISK_FORMULA_CONSTANTS.BANDS.CRITICAL).toBe(CONTRACT.BANDS.CRITICAL);
      expect(RISK_FORMULA_CONSTANTS.BANDS.HIGH).toBe(CONTRACT.BANDS.HIGH);
      expect(RISK_FORMULA_CONSTANTS.BANDS.MEDIUM).toBe(CONTRACT.BANDS.MEDIUM);
    });
  });

  describe("Score Computation Contract", () => {
    test.each(CONTRACT_TEST_CASES)(
      "inputs ($incidents, $critHigh, $days, $rejection, $spikes) → score=$expectedScore, band=$expectedBand",
      ({ incidents, critHigh, days, rejection, spikes, expectedScore, expectedBand }) => {
        const result = computeRiskScore(incidents, critHigh, days, rejection, spikes);
        expect(result.score).toBe(expectedScore);
        expect(result.band).toBe(expectedBand);
      }
    );
  });

  describe("Score Bounding", () => {
    it("score is bounded 0-100 for extreme max inputs", () => {
      const result = computeRiskScore(10000, 10000, 10000, 1.0, 10000);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBe(100);
    });

    it("score is bounded 0-100 for all-zero inputs", () => {
      const result = computeRiskScore(0, 0, 0, 0.0, 0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBe(0);
    });
  });

  describe("Band Assignment", () => {
    it("scoreToBand returns Critical for score >= 75", () => {
      expect(scoreToBand(75)).toBe("Critical");
      expect(scoreToBand(100)).toBe("Critical");
    });

    it("scoreToBand returns High for score 55-74", () => {
      expect(scoreToBand(55)).toBe("High");
      expect(scoreToBand(74)).toBe("High");
    });

    it("scoreToBand returns Medium for score 30-54", () => {
      expect(scoreToBand(30)).toBe("Medium");
      expect(scoreToBand(54)).toBe("Medium");
    });

    it("scoreToBand returns Low for score < 30", () => {
      expect(scoreToBand(0)).toBe("Low");
      expect(scoreToBand(29)).toBe("Low");
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTATION OUTPUT
// ══════════════════════════════════════════════════════════════════════════════

describe("Formula Documentation", () => {
  it("logs contract values for reference", () => {
    console.log("=== RISK FORMULA CONTRACT (TypeScript) ===");
    console.log(`Incident ceiling:    ${RISK_FORMULA_CONSTANTS.INCIDENT_CEILING} (200 incidents = max)`);
    console.log(`Audit ceiling:       ${RISK_FORMULA_CONSTANTS.AUDIT_CEILING} (180 days = max)`);
    console.log(`Rejection amplifier: ${RISK_FORMULA_CONSTANTS.REJECTION_AMP} (20% = max)`);
    console.log(`Spike ceiling:       ${RISK_FORMULA_CONSTANTS.SPIKE_CEILING} (10 spikes = max)`);
    console.log(`Weights:             ${Object.values(RISK_FORMULA_CONSTANTS.WEIGHTS).join(" / ")}`);
    console.log(`Band thresholds:     Critical≥${RISK_FORMULA_CONSTANTS.BANDS.CRITICAL}, ` +
                `High≥${RISK_FORMULA_CONSTANTS.BANDS.HIGH}, ` +
                `Medium≥${RISK_FORMULA_CONSTANTS.BANDS.MEDIUM}, ` +
                `Low<${RISK_FORMULA_CONSTANTS.BANDS.MEDIUM}`);
    console.log("==========================================");
    expect(true).toBe(true);
  });
});
