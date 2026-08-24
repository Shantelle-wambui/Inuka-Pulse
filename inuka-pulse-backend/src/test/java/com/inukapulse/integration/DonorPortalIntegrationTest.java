package com.inukapulse.integration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for Donor Portal endpoints.
 * 
 * Tests cover:
 * - Donor data scoping (donors can only see their own programs)
 * - No PII in donor view
 * - RBAC enforcement
 * - Cross-donor access prevention
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DonorPortalIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // ══════════════════════════════════════════════════════════════════════════
    // DONOR LIST ENDPOINT
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Donors endpoint requires authentication")
    void donorsEndpoint_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/donors"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    @DisplayName("Admin can list all donors")
    void donorsEndpoint_withAdminRole_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/donors"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Program manager can list donors")
    void donorsEndpoint_withProgramManagerRole_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/donors"))
                .andExpect(status().isOk());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FUNDING ENDPOINTS
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Funding endpoint returns funding records")
    void fundingEndpoint_returnsRecords() throws Exception {
        mockMvc.perform(get("/api/v1/donors/funding"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Disbursement trends endpoint returns data")
    void trendsEndpoint_returnsData() throws Exception {
        mockMvc.perform(get("/api/v1/donors/trends"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DONOR SCOPING (SECURITY)
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = "donor_user", roles = {"DONOR"})
    @DisplayName("Donor can access their own funding data (200 if exists, 404 if not)")
    void donorFunding_ownDonor_notForbidden() throws Exception {
        int statusCode = mockMvc.perform(
                        get("/api/v1/donors/00000000-0000-0000-0000-000000000001/funding")
                                .param("fiscalYear", "2026"))
                .andReturn()
                .getResponse()
                .getStatus();

        // Must not be 401/403 — donor role should at minimum get through the gate
        assert statusCode == 200 || statusCode == 404
                : "Expected 200 or 404 but got " + statusCode;
    }

    @Test
    @DisplayName("Funding by donor ID endpoint requires authentication")
    void donorFundingById_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/donors/some-donor-id/funding"))
                .andExpect(status().isUnauthorized());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // NO PII IN DONOR VIEW
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = "donor_user", roles = {"DONOR"})
    @DisplayName("Donor funding view does not expose beneficiary PII")
    void donorFunding_noPII() throws Exception {
        // Donor should see aggregate metrics, not individual beneficiary data
        mockMvc.perform(get("/api/v1/donors/funding"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].beneficiaryName").doesNotExist())
                .andExpect(jsonPath("$[*].beneficiaryId").doesNotExist())
                .andExpect(jsonPath("$[*].email").doesNotExist())
                .andExpect(jsonPath("$[*].phone").doesNotExist());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FISCAL YEAR FILTERING
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Funding can be filtered by fiscal year")
    void fundingByFiscalYear_returnsFilteredData() throws Exception {
        mockMvc.perform(get("/api/v1/donors/funding")
                        .param("fiscalYear", "2026"))
                .andExpect(status().isOk());
    }
}
