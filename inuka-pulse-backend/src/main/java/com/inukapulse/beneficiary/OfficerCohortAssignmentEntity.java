package com.inukapulse.beneficiary;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * JPA entity for the officer_cohort_assignment table.
 *
 * Maps a Case Manager (app_user.id) to the cohort IDs they are responsible for.
 * One officer → many cohorts; one cohort → many officers (many-to-many via this table).
 */
@Entity
@Table(name = "officer_cohort_assignment")
@Data
@NoArgsConstructor
public class OfficerCohortAssignmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** app_user.id of the Case Manager */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** e.g. "COHORT-SC-001" */
    @Column(name = "cohort_id", nullable = false, length = 50)
    private String cohortId;

    @Column(name = "assigned_at", updatable = false)
    private LocalDateTime assignedAt;

    @PrePersist
    protected void onCreate() {
        if (assignedAt == null) assignedAt = LocalDateTime.now();
    }
}
