package com.inukapulse.beneficiary;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * API response DTO for a single beneficiary's latest dropout risk prediction.
 *
 * topFeaturesList is parsed from the pipe-delimited topFeatures string so
 * the frontend does not need to split it.
 *
 * riskLevel is a user-friendly label derived from predictedBand.
 */
@Data
@Builder
public class BeneficiaryPredictionDto {

    private String  beneficiaryId;
    private String  cohortId;
    private String  pillar;
    private String  county;
    private String  asOfDate;

    /** Dropout probability 0.0–1.0, e.g. 0.789 */
    private Double  dropoutProb;

    /** Percentage string for display, e.g. "78.9%" */
    private String  dropoutProbPct;

    /** Active | At-Risk | Disengaged | Dropout */
    private String  predictedBand;

    /** Human-readable risk label for UI badges */
    private String  riskLevel;

    /** Parsed list of top risk feature names */
    private List<String> topFeaturesList;

    /** Raw pipe-delimited string (kept for compatibility) */
    private String  topFeatures;

    /**
     * Engagement score 0–100 (higher = more engaged).
     * Computed by EtlReloadService on each load cycle.
     * Null if not yet computed.
     */
    private Double  engagementScore;

    /** High (70–100) | Medium (40–69) | Low (0–39) */
    private String  engagementBand;

    // ── Static factory ───────────────────────────────────────────────────────

    public static BeneficiaryPredictionDto from(BeneficiaryPredictionEntity e) {
        List<String> features = e.getTopFeatures() != null
                ? List.of(e.getTopFeatures().split("\\|"))
                : List.of();

        // Compute engagement score if not yet persisted (back-compat for rows
        // loaded before V34 migration ran). Once ETL reloads, the persisted
        // value takes over.
        Double score = e.getEngagementScore() != null
                ? e.getEngagementScore()
                : computeEngagementScore(e.getDropoutProb(), e.getPredictedBand());
        String band  = e.getEngagementBand() != null
                ? e.getEngagementBand()
                : toEngagementBand(score);

        return BeneficiaryPredictionDto.builder()
                .beneficiaryId(e.getBeneficiaryId())
                .cohortId(e.getCohortId())
                .pillar(e.getPillar())
                .county(e.getCounty())
                .asOfDate(e.getAsOfDate() != null ? e.getAsOfDate().toString() : null)
                .dropoutProb(e.getDropoutProb())
                .dropoutProbPct(formatPct(e.getDropoutProb()))
                .predictedBand(e.getPredictedBand())
                .riskLevel(toRiskLevel(e.getPredictedBand()))
                .topFeatures(e.getTopFeatures())
                .topFeaturesList(features)
                .engagementScore(score)
                .engagementBand(band)
                .build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static String formatPct(Double prob) {
        if (prob == null) return "—";
        return String.format("%.1f%%", prob * 100);
    }

    /**
     * Maps the ML predicted_band to a short risk label shown in the UI.
     */
    public static String toRiskLevel(String band) {
        if (band == null) return "Unknown";
        return switch (band) {
            case "Active"     -> "Active";
            case "At-Risk"    -> "At-Risk";
            case "Disengaged" -> "Disengaged";
            case "Dropout"    -> "High Risk";
            default           -> band;
        };
    }

    /**
     * Computes engagement score (0–100) from dropout probability and risk band.
     *
     * Formula:
     *   base       = (1 - dropoutProb) * 100   → inverted dropout probability
     *   adjustment:
     *     Active     → +5   (confirmed engaged)
     *     Disengaged → -5   (confirmed disengaging)
     *     Dropout    → -10  (confirmed high risk)
     *     At-Risk    →  0   (neutral)
     *   score = clamp(base + adjustment, 0, 100)
     *
     * Once the ETL pipeline computes raw feature values and populates the
     * engagement_score column directly, this fallback is no longer used.
     */
    public static double computeEngagementScore(Double dropoutProb, String band) {
        if (dropoutProb == null) return 50.0;
        double base = (1.0 - dropoutProb) * 100.0;
        double adjustment = switch (band != null ? band : "") {
            case "Active"     ->  5.0;
            case "Disengaged" -> -5.0;
            case "Dropout"    -> -10.0;
            default           ->  0.0;
        };
        return Math.max(0.0, Math.min(100.0, base + adjustment));
    }

    /**
     * Derives engagement band from score.
     * High: 70–100 | Medium: 40–69 | Low: 0–39
     */
    public static String toEngagementBand(Double score) {
        if (score == null) return "Medium";
        if (score >= 70.0) return "High";
        if (score >= 40.0) return "Medium";
        return "Low";
    }
}
