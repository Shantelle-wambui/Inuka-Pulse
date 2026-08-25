package com.inukapulse.beneficiary;

import lombok.Builder;
import lombok.Data;

/**
 * DTO representing a single risk factor contributing to a beneficiary's
 * escalation probability.
 */
@Data
@Builder
public class RiskDriverDto {
    /** Raw feature name from ML model, e.g. "field_visit_gap_days" */
    private String featureName;
    
    /** Human-readable name, e.g. "Days Since Last Field Visit" */
    private String displayName;
    
    /** Impact level description, e.g. "Primary risk driver" */
    private String impact;
    
    /** Actionable recommendation, e.g. "Schedule field visit within 7 days" */
    private String recommendation;
}
