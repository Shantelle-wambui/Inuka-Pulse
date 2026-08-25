package com.inukapulse.beneficiary;

import lombok.Data;

/**
 * Request body for POST /api/beneficiaries/{beneficiaryId}/follow-ups
 */
@Data
public class RecordFollowUpRequest {

    /** phone_call | home_visit | sms | email | other */
    private String contactType;

    /** reached | no_answer | left_message | escalated */
    private String outcome;

    /** Free-text notes (optional) */
    private String notes;

    /**
     * Date of contact in ISO format (yyyy-MM-dd).
     * Defaults to today on the backend if not provided.
     */
    private String followUpDate;

    /** Optional next action text */
    private String nextAction;
}
