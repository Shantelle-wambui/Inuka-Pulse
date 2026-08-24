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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for Resource Allocation endpoints.
 *
 * Tests cover:
 * - Allocation recommendations retrieval
 * - Approval/rejection workflow
 * - RBAC enforcement (only PM/Executive can approve)
 * - HITL: no auto-promotion of ML recommendations
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AllocationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // ── Recommendations ───────────────────────────────────────────────────────

    @Test
    @DisplayName("Recommendations endpoint requires authentication")
    void recommendationsEndpoint_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/allocations/recommendations"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Recommendations accessible with PROGRAM_MANAGER role")
    void recommendationsEndpoint_withProgramManagerRole_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/allocations/recommendations"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "exec", roles = {"EXECUTIVE"})
    @DisplayName("Recommendations accessible with EXECUTIVE role")
    void recommendationsEndpoint_withExecutiveRole_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/allocations/recommendations"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "analyst", roles = {"ANALYST"})
    @DisplayName("Recommendations NOT accessible with ANALYST role")
    void recommendationsEndpoint_withAnalystRole_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/allocations/recommendations"))
                .andExpect(status().isForbidden());
    }

    // ── Statistics ────────────────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Allocation stats returns expected structure")
    void allocationStats_returnsExpectedStructure() throws Exception {
        mockMvc.perform(get("/api/v1/allocations/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalAllocations").exists())
                .andExpect(jsonPath("$.approvedCount").exists())
                .andExpect(jsonPath("$.pendingCount").exists())
                .andExpect(jsonPath("$.totalBudget").exists());
    }

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Region summary returns grouped data")
    void regionSummary_returnsGroupedData() throws Exception {
        mockMvc.perform(get("/api/v1/allocations/region-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    // ── Approval workflow ─────────────────────────────────────────────────────

    @Test
    @DisplayName("Approval endpoint requires authentication")
    void approvalEndpoint_noAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/allocations/test-id/approve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "field_coord", roles = {"FIELD_COORDINATOR"})
    @DisplayName("Field coordinator cannot approve allocations")
    void approvalEndpoint_withFieldCoordinatorRole_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/allocations/test-id/approve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Program manager can attempt approval (200 if exists, 404 if not, never 403)")
    void approvalEndpoint_withProgramManagerRole_notForbidden() throws Exception {
        int statusCode = mockMvc.perform(
                        post("/api/v1/allocations/00000000-0000-0000-0000-000000000001/approve")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"notes\": \"Test approval\"}"))
                .andReturn()
                .getResponse()
                .getStatus();

        // Must be 200 or 404 — never 401/403
        assert statusCode == 200 || statusCode == 404
                : "Expected 200 or 404 but got " + statusCode;
    }

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Rejection endpoint: same RBAC as approval (200 or 404, never 403)")
    void rejectionEndpoint_withProgramManagerRole_notForbidden() throws Exception {
        int statusCode = mockMvc.perform(
                        post("/api/v1/allocations/00000000-0000-0000-0000-000000000001/reject")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\": \"Test rejection\"}"))
                .andReturn()
                .getResponse()
                .getStatus();

        assert statusCode == 200 || statusCode == 404
                : "Expected 200 or 404 but got " + statusCode;
    }

    // ── HITL: no auto-promotion ───────────────────────────────────────────────

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Recommendations have 'pending' status by default (no auto-promotion)")
    void recommendations_havePendingStatus() throws Exception {
        mockMvc.perform(get("/api/v1/allocations/recommendations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.status == 'approved')]").isEmpty());
    }
}
