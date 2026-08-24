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

    // ── Static factory ───────────────────────────────────────────────────────

    public static BeneficiaryPredictionDto from(BeneficiaryPredictionEntity e) {
        List<String> features = e.getTopFeatures() != null
                ? List.of(e.getTopFeatures().split("\\|"))
                : List.of();

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
                .build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static String formatPct(Double prob) {
        if (prob == null) return "—";
        return String.format("%.1f%%", prob * 100);
    }

    /**
     * Maps the ML predicted_band to a short risk label shown in the UI.
     * Language is intentionally non-deterministic ("Predicted risk") to
     * avoid presenting the model's output as absolute fact.
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
}
