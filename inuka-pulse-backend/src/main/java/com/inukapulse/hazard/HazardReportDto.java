package com.inukapulse.hazard;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class HazardReportDto {
    private String id;
    private String siteId;
    private String siteName;
    private Long assetId;
    private String category;
    private String description;
    private String severityEstimate;
    private Long reporterId;
    private String reporterEmail;
    private String photoUrl;
    private Integer likelihoodRating;
    private Integer severityRating;
    private Integer riskRating;
    private String mitigationNote;
    private Long assessedBy;
    private String assessedByEmail;
    private LocalDateTime assessedAt;
    private String linkedAlertId;
    private String status;
    private LocalDateTime createdAt;
    /** 'hazard' | 'near_miss' | 'welfare_concern' */
    private String reportType;
    /** Populated for welfare_concern reports raised from beneficiary detail page. */
    private String beneficiaryId;
}
