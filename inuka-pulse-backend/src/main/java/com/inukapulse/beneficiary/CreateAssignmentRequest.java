package com.inukapulse.beneficiary;

import lombok.Data;

/**
 * Request body for POST /api/admin/assignments.
 * Assigns a Case Manager (userId) to a cohort (cohortId).
 */
@Data
public class CreateAssignmentRequest {
    private Long   userId;
    private String cohortId;
}
