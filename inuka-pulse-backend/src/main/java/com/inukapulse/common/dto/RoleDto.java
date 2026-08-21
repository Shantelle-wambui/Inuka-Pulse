package com.inukapulse.common.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RoleDto {
    private Long id;
    private String name;
    private String description;
}
