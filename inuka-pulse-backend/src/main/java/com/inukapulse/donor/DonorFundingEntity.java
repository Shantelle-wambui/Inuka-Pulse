package com.inukapulse.donor;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "donor_funding")
public class DonorFundingEntity {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    @Column(name = "donor_id", length = 50, nullable = false)
    private String donorId;

    @Column(name = "program_id", length = 50, nullable = false)
    private String programId;

    @Column(name = "amount_kes", precision = 15, scale = 2, nullable = false)
    private BigDecimal amountKes;

    @Column(name = "currency", length = 3)
    private String currency = "KES";

    @Column(name = "fiscal_year", nullable = false)
    private Integer fiscalYear;

    @Column(name = "disbursed_to_date", precision = 15, scale = 2)
    private BigDecimal disbursedToDate = BigDecimal.ZERO;

    @Column(name = "funding_status", length = 20)
    private String fundingStatus = "active";

    @Column(name = "commitment_date")
    private LocalDate commitmentDate;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public DonorFundingEntity() {
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Computed property: disbursement rate
    public BigDecimal getDisbursementRate() {
        if (amountKes == null || amountKes.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return disbursedToDate.divide(amountKes, 4, java.math.RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));
    }

    // Computed property: funding gap
    public BigDecimal getFundingGap() {
        if (amountKes == null || disbursedToDate == null) {
            return BigDecimal.ZERO;
        }
        return amountKes.subtract(disbursedToDate);
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDonorId() {
        return donorId;
    }

    public void setDonorId(String donorId) {
        this.donorId = donorId;
    }

    public String getProgramId() {
        return programId;
    }

    public void setProgramId(String programId) {
        this.programId = programId;
    }

    public BigDecimal getAmountKes() {
        return amountKes;
    }

    public void setAmountKes(BigDecimal amountKes) {
        this.amountKes = amountKes;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Integer getFiscalYear() {
        return fiscalYear;
    }

    public void setFiscalYear(Integer fiscalYear) {
        this.fiscalYear = fiscalYear;
    }

    public BigDecimal getDisbursedToDate() {
        return disbursedToDate;
    }

    public void setDisbursedToDate(BigDecimal disbursedToDate) {
        this.disbursedToDate = disbursedToDate;
    }

    public String getFundingStatus() {
        return fundingStatus;
    }

    public void setFundingStatus(String fundingStatus) {
        this.fundingStatus = fundingStatus;
    }

    public LocalDate getCommitmentDate() {
        return commitmentDate;
    }

    public void setCommitmentDate(LocalDate commitmentDate) {
        this.commitmentDate = commitmentDate;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
