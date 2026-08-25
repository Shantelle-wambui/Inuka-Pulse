package com.inukapulse.beneficiary;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * DTO containing a full interpretation of a beneficiary's risk prediction.
 * Translates raw ML output into actionable insights for case managers.
 */
@Data
@Builder
public class PredictionInterpretationDto {
    /** Beneficiary identifier, e.g. "BEN-00001" */
    private String beneficiaryId;
    
    /** Predicted risk band: Active, At-Risk, Disengaged, or Dropout */
    private String predictedBand;
    
    /** 30-day escalation probability (0.0-1.0) */
    private Double escalationProbability;
    
    /** Confidence level: High, Medium, or Low */
    private String confidenceLevel;
    
    /** Top risk factors driving the prediction */
    private List<RiskDriverDto> topRiskDrivers;
    
    /** Actionable recommendations for case managers */
    private List<String> recommendedActions;
    
    /** Human-readable narrative explaining the prediction */
    private String interpretationNarrative;
}
