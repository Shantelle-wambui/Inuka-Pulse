package com.inukapulse.beneficiary;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * JPA entity for the beneficiary_prediction table.
 *
 * Each row is the ML model's latest dropout risk score for one beneficiary
 * on a given as_of_date. Sourced from inuka_predictions_export.json via ETL.
 *
 * Distinct from PredictionEntity (fact_predictions) which is site/cohort level.
 */
@Entity
@Table(name = "beneficiary_prediction")
@Data
@NoArgsConstructor
public class BeneficiaryPredictionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** e.g. "BEN-00001" */
    @Column(name = "beneficiary_id", nullable = false, length = 50)
    private String beneficiaryId;

    /** e.g. "COHORT-SC-001" */
    @Column(name = "cohort_id", length = 50)
    private String cohortId;

    /** Scholarship | Plus | Vocational | Tech */
    @Column(name = "pillar", length = 100)
    private String pillar;

    /** Nairobi | Mombasa | Nakuru | Kisumu | Eldoret */
    @Column(name = "county", length = 100)
    private String county;

    /** Date the prediction was computed */
    @Column(name = "as_of_date", nullable = false)
    private LocalDate asOfDate;

    /** Dropout probability 0.0–1.0 */
    @Column(name = "dropout_prob", nullable = false, columnDefinition = "NUMERIC(7,4)")
    private Double dropoutProb;

    /** Active | At-Risk | Disengaged | Dropout */
    @Column(name = "predicted_band", nullable = false, length = 50)
    private String predictedBand;

    /**
     * Pipe-delimited top risk features, e.g.:
     * "field_visit_gap_days|attendance_rate_30d|days_since_last_contact"
     */
    @Column(name = "top_features", columnDefinition = "TEXT")
    private String topFeatures;

    /**
     * Engagement score 0–100.
     * Higher = more engaged / lower dropout risk.
     * Formula: (1 - dropoutProb) * 100, adjusted by band weighting.
     * Populated by EtlReloadService on each load cycle.
     */
    @Column(name = "engagement_score", columnDefinition = "NUMERIC(5,2)")
    private Double engagementScore;

    /**
     * Engagement band derived from engagement_score.
     * High (70–100) | Medium (40–69) | Low (0–39)
     */
    @Column(name = "engagement_band", length = 20)
    private String engagementBand;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
