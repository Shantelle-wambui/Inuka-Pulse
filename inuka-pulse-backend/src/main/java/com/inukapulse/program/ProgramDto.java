package com.inukapulse.program;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ProgramDto(
    String programId,
    String pillar,
    String name,
    String county,
    LocalDate startDate,
    LocalDate endDate,
    Integer targetCapacity,
    String status,
    String description,
    // Computed fields
    Integer currentEnrollment,
    BigDecimal capacityUtilization,
    BigDecimal totalFunding,
    BigDecimal disbursedAmount,
    BigDecimal fundingGap,
    Integer cohortCount,
    List<String> donors
) {
    public static ProgramDto from(ProgramEntity entity) {
        return new ProgramDto(
            entity.getProgramId(),
            entity.getPillar(),
            entity.getName(),
            entity.getCounty(),
            entity.getStartDate(),
            entity.getEndDate(),
            entity.getTargetCapacity(),
            entity.getStatus(),
            entity.getDescription(),
            null, null, null, null, null, null, null
        );
    }

    public static ProgramDto withMetrics(
            ProgramEntity entity,
            Integer currentEnrollment,
            BigDecimal totalFunding,
            BigDecimal disbursedAmount,
            Integer cohortCount,
            List<String> donors
    ) {
        BigDecimal utilization = entity.getTargetCapacity() > 0 && currentEnrollment != null
            ? BigDecimal.valueOf(currentEnrollment).divide(BigDecimal.valueOf(entity.getTargetCapacity()), 4, java.math.RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        
        BigDecimal fundingGap = totalFunding != null && disbursedAmount != null
            ? totalFunding.subtract(disbursedAmount)
            : BigDecimal.ZERO;

        return new ProgramDto(
            entity.getProgramId(),
            entity.getPillar(),
            entity.getName(),
            entity.getCounty(),
            entity.getStartDate(),
            entity.getEndDate(),
            entity.getTargetCapacity(),
            entity.getStatus(),
            entity.getDescription(),
            currentEnrollment,
            utilization,
            totalFunding,
            disbursedAmount,
            fundingGap,
            cohortCount,
            donors
        );
    }
}
