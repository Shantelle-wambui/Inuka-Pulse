package com.inukapulse.beneficiary;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * JPA entity for the beneficiary_follow_up table.
 *
 * Records a Case Manager's contact attempt or intervention for a beneficiary.
 * This is the human loop that closes the prediction → action → outcome cycle.
 */
@Entity
@Table(name = "beneficiary_follow_up")
@Data
@NoArgsConstructor
public class BeneficiaryFollowUpEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** e.g. "BEN-00003" */
    @Column(name = "beneficiary_id", nullable = false, length = 50)
    private String beneficiaryId;

    /** app_user.id of the Case Manager who made contact */
    @Column(name = "officer_id", nullable = false)
    private Long officerId;

    /** phone_call | home_visit | sms | email | other */
    @Column(name = "contact_type", nullable = false, length = 50)
    private String contactType;

    /** reached | no_answer | left_message | escalated */
    @Column(name = "outcome", nullable = false, length = 50)
    private String outcome;

    /** Free-text notes about what was discussed or observed */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    /** Date the contact was made (defaults to today) */
    @Column(name = "follow_up_date", nullable = false)
    private LocalDate followUpDate;

    /** Optional: what the Case Manager plans to do next */
    @Column(name = "next_action", columnDefinition = "TEXT")
    private String nextAction;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
