# Task 11: Create PredictionInterpretationService (Phase 6)

## Files
- Create: `inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/PredictionInterpretationService.java`
- Create: `inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/PredictionInterpretationDto.java`
- Modify: `inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/BeneficiaryController.java` (add endpoint)

## Interfaces
- Input: `beneficiaryId` (e.g., "BEN-00001")
- Output: `PredictionInterpretationDto` containing:
  - `beneficiaryId`: String
  - `predictedBand`: String (Active/At-Risk/Disengaged/Dropout)
  - `escalationProbability`: Double (0.0-1.0, from dropoutProb)
  - `confidenceLevel`: String (High/Medium/Low based on probability distance from threshold)
  - `topRiskDrivers`: List<RiskDriverDto> (feature name, value, impact description)
  - `recommendedActions`: List<String> (based on band and top drivers)
  - `interpretationNarrative`: String (human-readable explanation)

## Context

The model now predicts 30-day escalation probability. This service translates raw ML output into actionable insights for case managers:
- What is the predicted risk?
- Why is this beneficiary at risk? (feature interpretation)
- What should the case manager do? (recommended actions)

This service consumes `BeneficiaryPredictionEntity` data and enhances it with interpretation logic.

## Steps

### Step 1: Create RiskDriverDto

```java
package com.inukapulse.beneficiary;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RiskDriverDto {
    private String featureName;         // e.g. "field_visit_gap_days"
    private String displayName;         // e.g. "Days Since Last Field Visit"
    private String impact;              // e.g. "High negative impact"
    private String recommendation;      // e.g. "Schedule field visit within 7 days"
}
```

### Step 2: Create PredictionInterpretationDto

```java
package com.inukapulse.beneficiary;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class PredictionInterpretationDto {
    private String beneficiaryId;
    private String predictedBand;
    private Double escalationProbability;
    private String confidenceLevel;          // High, Medium, Low
    private List<RiskDriverDto> topRiskDrivers;
    private List<String> recommendedActions;
    private String interpretationNarrative;
}
```

### Step 3: Create PredictionInterpretationService

```java
package com.inukapulse.beneficiary;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PredictionInterpretationService {

    private final BeneficiaryPredictionRepository predictionRepository;

    // Feature display names
    private static final Map<String, String> FEATURE_DISPLAY_NAMES = Map.of(
        "days_since_last_contact", "Days Since Last Contact",
        "field_visit_gap_days", "Days Since Field Visit",
        "attendance_rate_30d", "30-Day Attendance Rate",
        "missed_sessions_14d", "Missed Sessions (14 days)",
        "missed_disbursements_60d", "Missed Disbursements (60 days)",
        "disbursement_delay_days", "Disbursement Delay Days",
        "assessment_score_latest", "Latest Assessment Score",
        "assessment_score_trend", "Assessment Score Trend",
        "no_contact_visits_90d", "No-Contact Visits (90 days)",
        "sessions_attended_30d", "Sessions Attended (30 days)"
    );

    // Feature-specific recommendations
    private static final Map<String, String> FEATURE_RECOMMENDATIONS = Map.of(
        "days_since_last_contact", "Schedule immediate contact with beneficiary",
        "field_visit_gap_days", "Schedule field visit within 7 days",
        "attendance_rate_30d", "Review attendance barriers, consider peer support",
        "missed_sessions_14d", "Follow up on missed sessions, check for issues",
        "missed_disbursements_60d", "Verify disbursement issues, escalate to finance",
        "disbursement_delay_days", "Expedite pending disbursements",
        "assessment_score_latest", "Review recent assessment, adjust support plan",
        "assessment_score_trend", "Investigate declining performance trend",
        "no_contact_visits_90d", "Conduct welfare check visit",
        "sessions_attended_30d", "Encourage session participation"
    );

    public Optional<PredictionInterpretationDto> getInterpretation(String beneficiaryId) {
        return predictionRepository.findLatestByBeneficiaryId(beneficiaryId)
            .map(this::buildInterpretation);
    }

    private PredictionInterpretationDto buildInterpretation(BeneficiaryPredictionEntity prediction) {
        String band = prediction.getPredictedBand();
        Double prob = prediction.getDropoutProb();
        String topFeatures = prediction.getTopFeatures();

        // Parse top features
        List<RiskDriverDto> riskDrivers = parseRiskDrivers(topFeatures);

        // Determine confidence level
        String confidence = determineConfidence(prob);

        // Build recommended actions
        List<String> actions = buildRecommendedActions(band, riskDrivers);

        // Build narrative
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

    private String formatFeatureName(String feature) {
        return feature.replace("_", " ").substring(0, 1).toUpperCase() 
               + feature.replace("_", " ").substring(1);
    }

    private String determineConfidence(Double prob) {
        if (prob == null) return "Unknown";
        if (prob >= 0.70 || prob <= 0.20) return "High";
        if (prob >= 0.55 || prob <= 0.35) return "Medium";
        return "Low";
    }

    private List<String> buildRecommendedActions(String band, List<RiskDriverDto> drivers) {
        List<String> actions = new ArrayList<>();

        // Band-specific general action
        switch (band) {
            case "Dropout" -> actions.add("URGENT: Immediate welfare check and re-engagement plan required");
            case "Disengaged" -> actions.add("Schedule case review meeting within 48 hours");
            case "At-Risk" -> actions.add("Increase monitoring frequency and proactive outreach");
            case "Active" -> actions.add("Continue current support plan with regular check-ins");
        }

        // Add feature-specific recommendations
        for (RiskDriverDto driver : drivers) {
            if (driver.getRecommendation() != null && !actions.contains(driver.getRecommendation())) {
                actions.add(driver.getRecommendation());
            }
        }

        return actions;
    }

    private String buildNarrative(BeneficiaryPredictionEntity prediction, List<RiskDriverDto> drivers) {
        String band = prediction.getPredictedBand();
        Double prob = prediction.getDropoutProb();
        int probPct = (int) Math.round(prob * 100);

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("This beneficiary is currently classified as %s with a %d%% probability of escalation within 30 days. ", 
            band, probPct));

        if (!drivers.isEmpty()) {
            sb.append("The primary risk factors are: ");
            for (int i = 0; i < drivers.size(); i++) {
                if (i > 0) sb.append(i == drivers.size() - 1 ? ", and " : ", ");
                sb.append(drivers.get(i).getDisplayName().toLowerCase());
            }
            sb.append(". ");
        }

        // Add urgency based on band
        switch (band) {
            case "Dropout" -> sb.append("Immediate intervention is critical to prevent permanent disengagement.");
            case "Disengaged" -> sb.append("Prompt action is recommended to re-engage this beneficiary.");
            case "At-Risk" -> sb.append("Proactive monitoring can help prevent further deterioration.");
            case "Active" -> sb.append("Continue supportive engagement to maintain positive trajectory.");
        }

        return sb.toString();
    }
}
```

### Step 4: Add endpoint to BeneficiaryController

Find the existing `BeneficiaryController` or create one. Add:

```java
@Autowired
private PredictionInterpretationService interpretationService;

@GetMapping("/beneficiaries/{beneficiaryId}/interpretation")
public ResponseEntity<PredictionInterpretationDto> getInterpretation(
        @PathVariable String beneficiaryId) {
    return interpretationService.getInterpretation(beneficiaryId)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}
```

### Step 5: Verify compilation

```bash
cd inuka-pulse-backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS

### Step 6: Commit

```bash
git add src/main/java/com/inukapulse/beneficiary/
git commit -m "feat(backend): add PredictionInterpretationService for ML explainability"
```
