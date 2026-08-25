package com.inukapulse.beneficiary;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Service that transforms raw ML predictions into actionable interpretations
 * for case managers.
 *
 * Responsibilities:
 * - Translate feature names to human-readable descriptions
 * - Determine confidence level based on probability distance from thresholds
 * - Generate feature-specific and band-specific recommendations
 * - Build a narrative explanation of the prediction
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PredictionInterpretationService {

    private final BeneficiaryPredictionRepository predictionRepository;

    // Feature display names mapping
    private static final Map<String, String> FEATURE_DISPLAY_NAMES = Map.ofEntries(
        Map.entry("days_since_last_contact", "Days Since Last Contact"),
        Map.entry("field_visit_gap_days", "Days Since Field Visit"),
        Map.entry("attendance_rate_30d", "30-Day Attendance Rate"),
        Map.entry("missed_sessions_14d", "Missed Sessions (14 days)"),
        Map.entry("missed_disbursements_60d", "Missed Disbursements (60 days)"),
        Map.entry("disbursement_delay_days", "Disbursement Delay Days"),
        Map.entry("assessment_score_latest", "Latest Assessment Score"),
        Map.entry("assessment_score_trend", "Assessment Score Trend"),
        Map.entry("no_contact_visits_90d", "No-Contact Visits (90 days)"),
        Map.entry("sessions_attended_30d", "Sessions Attended (30 days)"),
        Map.entry("contact_frequency_7d", "Contact Frequency (7 days)"),
        Map.entry("engagement_score", "Engagement Score"),
        Map.entry("disbursement_utilization", "Disbursement Utilization Rate")
    );

    // Feature-specific recommendations mapping
    private static final Map<String, String> FEATURE_RECOMMENDATIONS = Map.ofEntries(
        Map.entry("days_since_last_contact", "Schedule immediate contact with beneficiary"),
        Map.entry("field_visit_gap_days", "Schedule field visit within 7 days"),
        Map.entry("attendance_rate_30d", "Review attendance barriers, consider peer support"),
        Map.entry("missed_sessions_14d", "Follow up on missed sessions, check for issues"),
        Map.entry("missed_disbursements_60d", "Verify disbursement issues, escalate to finance"),
        Map.entry("disbursement_delay_days", "Expedite pending disbursements"),
        Map.entry("assessment_score_latest", "Review recent assessment, adjust support plan"),
        Map.entry("assessment_score_trend", "Investigate declining performance trend"),
        Map.entry("no_contact_visits_90d", "Conduct welfare check visit"),
        Map.entry("sessions_attended_30d", "Encourage session participation"),
        Map.entry("contact_frequency_7d", "Increase contact frequency"),
        Map.entry("engagement_score", "Review engagement plan and incentives"),
        Map.entry("disbursement_utilization", "Counsel on financial planning")
    );

    /**
     * Retrieve and interpret the latest prediction for a beneficiary.
     *
     * @param beneficiaryId the beneficiary identifier
     * @return interpretation DTO if prediction exists, empty otherwise
     */
    public Optional<PredictionInterpretationDto> getInterpretation(String beneficiaryId) {
        return predictionRepository.findLatestByBeneficiaryId(beneficiaryId)
            .map(this::buildInterpretation);
    }

    private PredictionInterpretationDto buildInterpretation(BeneficiaryPredictionEntity prediction) {
        String band = prediction.getPredictedBand();
        Double prob = prediction.getDropoutProb();
        String topFeatures = prediction.getTopFeatures();

        // Parse top features into risk drivers
        List<RiskDriverDto> riskDrivers = parseRiskDrivers(topFeatures);

        // Determine confidence level based on probability
        String confidence = determineConfidence(prob);

        // Build recommended actions based on band and risk drivers
        List<String> actions = buildRecommendedActions(band, riskDrivers);

        // Build human-readable narrative
        String narrative = buildNarrative(prediction, riskDrivers);

        return PredictionInterpretationDto.builder()
            .beneficiaryId(prediction.getBeneficiaryId())
            .predictedBand(band)
            .escalationProbability(prob)
            .confidenceLevel(confidence)
            .topRiskDrivers(riskDrivers)
            .recommendedActions(actions)
            .interpretationNarrative(narrative)
            .build();
    }

    /**
     * Parse pipe-delimited top features string into structured RiskDriverDto list.
     */
    private List<RiskDriverDto> parseRiskDrivers(String topFeatures) {
        if (topFeatures == null || topFeatures.isBlank()) {
            return Collections.emptyList();
        }

        List<RiskDriverDto> drivers = new ArrayList<>();
        String[] features = topFeatures.split("\\|");
        String[] impacts = {"Primary risk driver", "Secondary risk factor", "Contributing factor"};

        for (int i = 0; i < Math.min(features.length, 3); i++) {
            String feature = features[i].trim();
            drivers.add(RiskDriverDto.builder()
                .featureName(feature)
                .displayName(FEATURE_DISPLAY_NAMES.getOrDefault(feature, formatFeatureName(feature)))
                .impact(impacts[i])
                .recommendation(FEATURE_RECOMMENDATIONS.getOrDefault(feature, "Review and assess"))
                .build());
        }
        return drivers;
    }

    /**
     * Convert snake_case feature name to Title Case display name.
     */
    private String formatFeatureName(String feature) {
        if (feature == null || feature.isEmpty()) {
            return "Unknown Feature";
        }
        String spaced = feature.replace("_", " ");
        return spaced.substring(0, 1).toUpperCase() + spaced.substring(1);
    }

    /**
     * Determine confidence level based on how far the probability is from
     * decision thresholds. Probabilities near extremes (0 or 1) indicate
     * high confidence; probabilities near 0.5 indicate low confidence.
     */
    private String determineConfidence(Double prob) {
        if (prob == null) return "Unknown";
        // High confidence: probability clearly in one direction
        if (prob >= 0.70 || prob <= 0.20) return "High";
        // Medium confidence: moderately clear
        if (prob >= 0.55 || prob <= 0.35) return "Medium";
        // Low confidence: near the decision boundary
        return "Low";
    }

    /**
     * Build prioritized list of recommended actions based on risk band
     * and individual risk drivers.
     */
    private List<String> buildRecommendedActions(String band, List<RiskDriverDto> drivers) {
        List<String> actions = new ArrayList<>();

        // Band-specific urgent action first
        switch (band) {
            case "Dropout" -> actions.add("URGENT: Immediate welfare check and re-engagement plan required");
            case "Disengaged" -> actions.add("Schedule case review meeting within 48 hours");
            case "At-Risk" -> actions.add("Increase monitoring frequency and proactive outreach");
            case "Active" -> actions.add("Continue current support plan with regular check-ins");
            default -> actions.add("Review beneficiary status and update support plan");
        }

        // Add feature-specific recommendations (avoid duplicates)
        for (RiskDriverDto driver : drivers) {
            String rec = driver.getRecommendation();
            if (rec != null && !actions.contains(rec)) {
                actions.add(rec);
            }
        }

        return actions;
    }

    /**
     * Build a human-readable narrative explaining the prediction.
     */
    private String buildNarrative(BeneficiaryPredictionEntity prediction, List<RiskDriverDto> drivers) {
        String band = prediction.getPredictedBand();
        Double prob = prediction.getDropoutProb();
        int probPct = prob != null ? (int) Math.round(prob * 100) : 0;

        StringBuilder sb = new StringBuilder();
        sb.append(String.format(
            "This beneficiary is currently classified as %s with a %d%% probability of escalation within 30 days. ",
            band, probPct));

        if (!drivers.isEmpty()) {
            sb.append("The primary risk factors are: ");
            for (int i = 0; i < drivers.size(); i++) {
                if (i > 0) sb.append(i == drivers.size() - 1 ? ", and " : ", ");
                sb.append(drivers.get(i).getDisplayName().toLowerCase());
            }
            sb.append(". ");
        }

        // Add urgency statement based on band
        switch (band) {
            case "Dropout" -> sb.append("Immediate intervention is critical to prevent permanent disengagement.");
            case "Disengaged" -> sb.append("Prompt action is recommended to re-engage this beneficiary.");
            case "At-Risk" -> sb.append("Proactive monitoring can help prevent further deterioration.");
            case "Active" -> sb.append("Continue supportive engagement to maintain positive trajectory.");
            default -> sb.append("Review the beneficiary's current status and adjust support accordingly.");
        }

        return sb.toString();
    }
}
