package com.inukapulse.beneficiary;

import lombok.Builder;
import lombok.Data;

/**
 * API DTO for a recorded follow-up action.
 * Returned by GET and POST endpoints.
 */
@Data
@Builder
public class BeneficiaryFollowUpDto {

    private Long   id;
    private String beneficiaryId;
    private Long   officerId;
    private String contactType;
    private String contactTypeLabel;   // human-friendly label
    private String outcome;
    private String outcomeLabel;       // human-friendly label
    private String notes;
    private String followUpDate;
    private String nextAction;
    private String createdAt;

    public static BeneficiaryFollowUpDto from(BeneficiaryFollowUpEntity e) {
        return BeneficiaryFollowUpDto.builder()
                .id(e.getId())
                .beneficiaryId(e.getBeneficiaryId())
                .officerId(e.getOfficerId())
                .contactType(e.getContactType())
                .contactTypeLabel(toContactLabel(e.getContactType()))
                .outcome(e.getOutcome())
                .outcomeLabel(toOutcomeLabel(e.getOutcome()))
                .notes(e.getNotes())
                .followUpDate(e.getFollowUpDate() != null ? e.getFollowUpDate().toString() : null)
                .nextAction(e.getNextAction())
                .createdAt(e.getCreatedAt() != null ? e.getCreatedAt().toString() : null)
                .build();
    }

    private static String toContactLabel(String type) {
        if (type == null) return "";
        return switch (type) {
            case "phone_call"  -> "Phone call";
            case "home_visit"  -> "Home visit";
            case "sms"         -> "SMS";
            case "email"       -> "Email";
            default            -> "Other";
        };
    }

    private static String toOutcomeLabel(String outcome) {
        if (outcome == null) return "";
        return switch (outcome) {
            case "reached"      -> "Reached — spoke with beneficiary";
            case "no_answer"    -> "No answer";
            case "left_message" -> "Left message / voicemail";
            case "escalated"    -> "Escalated — welfare concern raised";
            default             -> outcome;
        };
    }
}
