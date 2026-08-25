package com.inukapulse.donor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Summary DTO for Donor Portal view - contains only aggregated data, no PII.
 * This is the response format for donor-scoped dashboard.
 */
public record DonorSummaryDto(
    String donorId,
    String donorName,
    // Funding summary
    Long totalFundedPrograms,
    BigDecimal totalCommitment,
    BigDecimal totalDisbursed,
    BigDecimal disbursementRate,
    BigDecimal fundingGap,
    // Reach summary (aggregated, no individual beneficiary data)
    Long totalBeneficiariesReached,
    Long activeBeneficiaries,
    BigDecimal averageCompletionRate,
    // Program breakdown
    List<FundedProgramSummary> programs,
    // Pillar breakdown
    List<PillarSummary> pillarBreakdown
) {
    public record FundedProgramSummary(
        String programId,
        String programName,
        String pillar,
        String county,
        String status,
        BigDecimal fundingAmount,
        BigDecimal disbursedAmount,
        BigDecimal disbursementRate,
        Long beneficiariesServed,
        BigDecimal completionRate
    ) {}

    public record PillarSummary(
        String pillar,
        Long programCount,
        BigDecimal totalFunding,
        Long totalBeneficiaries
    ) {}
}
