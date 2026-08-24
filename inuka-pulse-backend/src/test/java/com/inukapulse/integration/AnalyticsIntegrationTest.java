package com.inukapulse.integration;

import com.inukapulse.analytics.AnalyticsController;
import com.inukapulse.analytics.AnalyticsService;
import com.inukapulse.analytics.PublicController;
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
 * Integration tests for Analytics and Public endpoints.
 * 
 * Tests cover:
 * - KPI endpoint returns correct structure
 * - Public endpoints require no auth
 * - RBAC enforcement on protected endpoints
 * - Response caching headers
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AnalyticsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // ══════════════════════════════════════════════════════════════════════════
    // PUBLIC ENDPOINTS (NO AUTH)
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Public impact summary should be accessible without auth")
    void publicImpactSummary_noAuth_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/public/impact-summary"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.totalReach").exists())
                .andExpect(jsonPath("$.reachByPillar").exists())
                .andExpect(jsonPath("$.countiesCovered").exists())
                .andExpect(jsonPath("$.overallCompletionRate").exists())
                .andExpect(jsonPath("$.lastUpdated").exists());
    }

    @Test
    @DisplayName("Public impact summary should have cache headers")
    void publicImpactSummary_hasCacheHeaders() throws Exception {
        mockMvc.perform(get("/api/v1/public/impact-summary"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Cache-Control"));
    }

    @Test
    @DisplayName("Public pillars endpoint should be accessible without auth")
    void publicPillars_noAuth_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/public/pillars"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));
    }

    @Test
    @DisplayName("Public endpoints should not contain PII")
    void publicEndpoints_noPII() throws Exception {
        // Impact summary should not contain beneficiary names, IDs, etc.
        mockMvc.perform(get("/api/v1/public/impact-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.beneficiaryNames").doesNotExist())
                .andExpect(jsonPath("$.beneficiaryIds").doesNotExist())
                .andExpect(jsonPath("$.emails").doesNotExist())
                .andExpect(jsonPath("$.phoneNumbers").doesNotExist());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PROTECTED ENDPOINTS (REQUIRE AUTH)
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("KPI endpoint requires authentication")
    void kpiEndpoint_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/kpis"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "analyst", roles = {"ANALYST"})
    @DisplayName("KPI endpoint accessible with ANALYST role")
    void kpiEndpoint_withAnalystRole_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/kpis"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.totalBeneficiaries").exists())
                .andExpect(jsonPath("$.activeBeneficiaries").exists())
                .andExpect(jsonPath("$.atRiskCohorts").exists());
    }

    @Test
    @WithMockUser(username = "pm", roles = {"PROGRAM_MANAGER"})
    @DisplayName("Impact endpoint accessible with PROGRAM_MANAGER role")
    void impactEndpoint_withProgramManagerRole_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/impact"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));
    }

    @Test
    @WithMockUser(username = "exec", roles = {"EXECUTIVE"})
    @DisplayName("Impact by pillar accessible with EXECUTIVE role")
    void impactByPillar_withExecutiveRole_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/impact/by-pillar"))
                .andExpect(status().isOk());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RESPONSE STRUCTURE VALIDATION
    // ══════════════════════════════════════════════════════════════════════════

    @Test
    @WithMockUser(username = "analyst", roles = {"ANALYST"})
    @DisplayName("Pillar analytics returns expected structure")
    void pillarAnalytics_returnsExpectedStructure() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/pillars"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "analyst", roles = {"ANALYST"})
    @DisplayName("Regional analytics returns expected structure")
    void regionalAnalytics_returnsExpectedStructure() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/regions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
