package com.inukapulse.hazard;

import lombok.Data;

@Data
public class CreateHazardReportRequest {
    private String siteId;
    private Long assetId;
    private String category;
    private String description;
    private String severityEstimate;
    private String photoUrl;
    /** 'hazard' (default) | 'near_miss' | 'welfare_concern' */
    private String reportType = "hazard";
    /**
     * Populated when report_type = 'welfare_concern' — links the report
     * to a specific beneficiary from the beneficiary detail page.
     */
    private String beneficiaryId;
}
