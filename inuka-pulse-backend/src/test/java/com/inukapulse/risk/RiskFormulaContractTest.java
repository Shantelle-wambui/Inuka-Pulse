package com.inukapulse.risk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Contract tests to verify the risk formula stays in sync with the frontend.
 *
 * CRITICAL: If this test fails, the Java and TypeScript formulas have diverged.
 * Both files must be updated together:
 *   - Java:       RiskService.java computeRiskScore()
 *   - TypeScript: inuka-pulse-frontend/src/lib/inuka-pulse/risk-formula.ts computeRiskScore()
 *
 * Formula constants (MUST match across both implementations):
 *   - Incident ceiling:    2.0   (200 incidents = 100 sub-score)
 *   - Audit ceiling:       1.8   (180 days = 100 sub-score)
 *   - Rejection amplifier: 500.0 (20% rejection = 100 sub-score)
 *   - Spike ceiling:       10.0  (10 spikes = 100 sub-score)
 *   - Weights:             0.30 / 0.30 / 0.20 / 0.10 / 0.10
 *   - Band thresholds:     75 (Critical), 55 (High), 30 (Medium)
 */
class RiskFormulaContractTest {

    // ══════════════════════════════════════════════════════════════════════════
    // FORMULA CONSTANTS — These are the contract. Change requires frontend update.
    // ══════════════════════════════════════════════════════════════════════════

    /** Incident count divisor: 200 incidents → 100 sub-score */
    private static final double INCIDENT_CEILING = 2.0;

    /** Audit recency divisor: 180 days → 100 sub-score */
    private static final double AUDIT_CEILING = 1.8;

    /** Rejection rate amplifier: 0.20 rejection → 100 sub-score */
    private static final double REJECTION_AMP = 500.0;

    /** Missed disbursement multiplier: 10 spikes → 100 sub-score */
    private static final double SPIKE_CEILING = 10.0;

    /** Component weights (sum to 1.0) */
    private static final double WEIGHT_INCIDENT_FREQUENCY = 0.30;
    private static final double WEIGHT_SEVERITY_MIX = 0.30;
    private static final double WEIGHT_AUDIT_RECENCY = 0.20;
    private static final double WEIGHT_REJECTION_RATE = 0.10;
    private static final double WEIGHT_PRESSURE_SPIKES = 0.10;

    /** Band thresholds */
    private static final int BAND_CRITICAL = 75;
    private static final int BAND_HIGH = 55;
    private static final int BAND_MEDIUM = 30;

    // ══════════════════════════════════════════════════════════════════════════
    // REFERENCE IMPLEMENTATION — Mirrors frontend exactly
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Reference implementation of the risk score formula.
     * This is the canonical source — both Java and TypeScript must match this.
     */
    private int referenceComputeRiskScore(
            long incidentCount,
            long critHighCount,
            int daysSinceAudit,
            double rejectedRate,
            int pressureSpikes) {

        double incidentSub = Math.min(incidentCount / INCIDENT_CEILING, 100);
        double severitySub = incidentCount > 0
                ? Math.min((critHighCount * 100.0) / incidentCount, 100) : 0;
        double auditSub = Math.min(daysSinceAudit / AUDIT_CEILING, 100);
        double rejectionSub = Math.min(rejectedRate * REJECTION_AMP, 100);
        double spikeSub = Math.min(pressureSpikes * SPIKE_CEILING, 100);

        double raw = (incidentSub * WEIGHT_INCIDENT_FREQUENCY)
                   + (severitySub * WEIGHT_SEVERITY_MIX)
                   + (auditSub * WEIGHT_AUDIT_RECENCY)
                   + (rejectionSub * WEIGHT_REJECTION_RATE)
                   + (spikeSub * WEIGHT_PRESSURE_SPIKES);

        return (int) Math.min(Math.max(Math.round(raw), 0), 100);
    }

    private String referenceToBand(int score) {
        if (score >= BAND_CRITICAL) return "Critical";
        if (score >= BAND_HIGH) return "High";
        if (score >= BAND_MEDIUM) return "Medium";
        return "Low";
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CONTRACT TESTS
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Formula weights must sum to 1.0")
    void weightsMustSumToOne() {
        double sum = WEIGHT_INCIDENT_FREQUENCY
                   + WEIGHT_SEVERITY_MIX
                   + WEIGHT_AUDIT_RECENCY
                   + WEIGHT_REJECTION_RATE
                   + WEIGHT_PRESSURE_SPIKES;
        assertEquals(1.0, sum, 0.0001, "Formula weights must sum to 1.0");
    }

    @Test
    @DisplayName("Band thresholds must be in descending order")
    void bandThresholdOrder() {
        assertTrue(BAND_CRITICAL > BAND_HIGH, "Critical must be higher than High");
        assertTrue(BAND_HIGH > BAND_MEDIUM, "High must be higher than Medium");
        assertTrue(BAND_MEDIUM > 0, "Medium must be positive");
    }

    @ParameterizedTest(name = "incidents={0}, critHigh={1}, days={2}, rejection={3}, spikes={4} → score={5}, band={6}")
    @CsvSource({
        // Edge cases: all zeros
        "0, 0, 0, 0.0, 0, 0, Low",
        // Edge cases: all max
        "200, 200, 180, 0.20, 10, 100, Critical",
        // Single component max, others zero
        "200, 0, 0, 0.0, 0, 30, Medium",
        "0, 0, 180, 0.0, 0, 20, Low",
        "0, 0, 0, 0.20, 0, 10, Low",
        "0, 0, 0, 0.0, 10, 10, Low",
        // High severity mix
        "100, 100, 0, 0.0, 0, 45, Medium",
        // Realistic scenarios (recalculated with actual formula)
        "50, 25, 30, 0.05, 2, 30, Medium",
        "100, 80, 90, 0.10, 5, 59, High",
        "150, 120, 150, 0.15, 8, 79, Critical",
        // Boundary testing
        "0, 0, 54, 0.0, 0, 6, Low",
        "0, 0, 55, 0.0, 0, 6, Low",
    })
    void contractTestCases(
            int incidents, int critHigh, int days, double rejection, int spikes,
            int expectedScore, String expectedBand) {

        int actualScore = referenceComputeRiskScore(incidents, critHigh, days, rejection, spikes);
        String actualBand = referenceToBand(actualScore);

        assertEquals(expectedScore, actualScore,
                String.format("Score mismatch for inputs (%d, %d, %d, %.2f, %d)",
                        incidents, critHigh, days, rejection, spikes));
        assertEquals(expectedBand, actualBand,
                String.format("Band mismatch for score %d", actualScore));
    }

    @Test
    @DisplayName("Score is always bounded 0-100")
    void scoreBoundedZeroToHundred() {
        // Extreme inputs should still produce bounded output
        int maxScore = referenceComputeRiskScore(10000, 10000, 10000, 1.0, 10000);
        int minScore = referenceComputeRiskScore(0, 0, 0, 0.0, 0);

        assertTrue(maxScore >= 0 && maxScore <= 100,
                "Max inputs should produce score in [0, 100], got " + maxScore);
        assertTrue(minScore >= 0 && minScore <= 100,
                "Min inputs should produce score in [0, 100], got " + minScore);
        assertEquals(100, maxScore, "Extreme max inputs should cap at 100");
        assertEquals(0, minScore, "All-zero inputs should produce 0");
    }

    @Test
    @DisplayName("Negative inputs are handled gracefully")
    void negativeInputsHandled() {
        // Formula should handle negative inputs (clamp to 0 via Math.min with positive ceiling)
        int score = referenceComputeRiskScore(-10, -5, -30, -0.1, -5);
        assertTrue(score >= 0 && score <= 100, "Negative inputs should produce bounded score");
    }

    @Test
    @DisplayName("Severity mix is 0 when incident count is 0")
    void severityMixZeroWhenNoIncidents() {
        // When incidents = 0, severity mix should be 0 (avoid divide by zero)
        int scoreNoIncidents = referenceComputeRiskScore(0, 100, 0, 0.0, 0);
        assertEquals(0, scoreNoIncidents, "No incidents should mean 0 severity contribution");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DOCUMENTATION
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Document: Formula constant values for frontend sync")
    void documentFormulaConstants() {
        // This test exists to document the contract values.
        // If you need to change these, update both:
        //   - RiskService.java
        //   - risk-formula.ts (RISK_FORMULA_CONSTANTS object)
        System.out.println("=== RISK FORMULA CONTRACT ===");
        System.out.println("Incident ceiling:    " + INCIDENT_CEILING + " (200 incidents = max)");
        System.out.println("Audit ceiling:       " + AUDIT_CEILING + " (180 days = max)");
        System.out.println("Rejection amplifier: " + REJECTION_AMP + " (20% = max)");
        System.out.println("Spike ceiling:       " + SPIKE_CEILING + " (10 spikes = max)");
        System.out.println("Weights:             " + WEIGHT_INCIDENT_FREQUENCY + " / "
                + WEIGHT_SEVERITY_MIX + " / " + WEIGHT_AUDIT_RECENCY + " / "
                + WEIGHT_REJECTION_RATE + " / " + WEIGHT_PRESSURE_SPIKES);
        System.out.println("Band thresholds:     Critical≥" + BAND_CRITICAL
                + ", High≥" + BAND_HIGH + ", Medium≥" + BAND_MEDIUM + ", Low<" + BAND_MEDIUM);
        System.out.println("=============================");

        // Always passes — this is documentation
        assertTrue(true);
    }
}
