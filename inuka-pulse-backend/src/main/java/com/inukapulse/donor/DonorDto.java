package com.inukapulse.donor;

import java.math.BigDecimal;

public record DonorDto(
    String donorId,
    String name,
    String contactEmail,
    String contactPhone,
    String organizationType,
    String country,
    Boolean isActive,
    // Computed fields for summary
    Long fundedProgramCount,
    BigDecimal totalCommitment,
    BigDecimal totalDisbursed,
    BigDecimal disbursementRate
) {
    public static DonorDto from(DonorEntity entity) {
        return new DonorDto(
            entity.getDonorId(),
            entity.getName(),
            entity.getContactEmail(),
            entity.getContactPhone(),
            entity.getOrganizationType(),
            entity.getCountry(),
            entity.getIsActive(),
            null, null, null, null
        );
    }

    public static DonorDto withSummary(
            DonorEntity entity,
            Long fundedProgramCount,
            BigDecimal totalCommitment,
            BigDecimal totalDisbursed
    ) {
        BigDecimal rate = totalCommitment != null && totalCommitment.compareTo(BigDecimal.ZERO) > 0 && totalDisbursed != null
            ? totalDisbursed.divide(totalCommitment, 4, java.math.RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
            : BigDecimal.ZERO;

        return new DonorDto(
            entity.getDonorId(),
            entity.getName(),
            entity.getContactEmail(),
            entity.getContactPhone(),
            entity.getOrganizationType(),
            entity.getCountry(),
            entity.getIsActive(),
            fundedProgramCount,
            totalCommitment,
            totalDisbursed,
            rate
        );
    }
}
