package com.inukapulse.program;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public record CreateProgramRequest(
    @NotBlank String programId,
    @NotBlank String pillar,
    @NotBlank String name,
    @NotBlank String county,
    @NotNull LocalDate startDate,
    LocalDate endDate,
    @NotNull @Positive Integer targetCapacity,
    String status,
    String description
) {}
