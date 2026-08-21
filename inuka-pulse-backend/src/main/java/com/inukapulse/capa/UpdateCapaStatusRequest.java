package com.inukapulse.capa;

import lombok.Data;

@Data
public class UpdateCapaStatusRequest {
    private String status;
    private String evidenceUrl;
}
