package com.inukapulse.analytics;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Analytics endpoints — serve KPIs, metrics, and pre-computed diagnostics.
 *
 * New endpoints for M&E scope:
 *   GET /api/v1/analytics/kpis              → Real-time KPI strip
 *   GET /api/v1/analytics/pillars           → Pillar-level rollups
 *   GET /api/v1/analytics/regions           → County/region rollups
 *   GET /api/v1/analytics/impact            → Impact & Reach metrics
 *   GET /api/v1/analytics/impact/by-pillar  → Impact metrics by pillar
 *   GET /api/v1/analytics/impact/trends     → Impact trends over time
 *   GET /api/v1/analytics/impact/county-reach → Geographic reach data
 *
 * Existing diagnostic endpoints (file-based):
 *   GET /api/analytics/survival-curves      → survival_curve_data.json
 *   GET /api/analytics/pressure-charts      → control_chart_data.json
 *   GET /api/analytics/correlation          → correlation_data.json
 *   GET /api/analytics/feature-importance   → feature_importance.json
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    // ══════════════════════════════════════════════════════════════════════════
    // New M&E Analytics Endpoints (v1)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Real-time KPI strip for dashboard.
     * Scoped by org/pillar/county/program/donor.
     */
    @GetMapping("/v1/analytics/kpis")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnalyticsService.KpiResponse> getKpis(
            @RequestParam(defaultValue = "org") String scope,
            @RequestParam(required = false) String scopeId
    ) {
        return ResponseEntity.ok(analyticsService.getKpis(scope, scopeId));
    }

    /**
     * Pillar-level metrics rollup.
     */
    @GetMapping("/v1/analytics/pillars")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AnalyticsService.PillarMetrics>> getPillarMetrics() {
        return ResponseEntity.ok(analyticsService.getPillarMetrics());
    }

    /**
     * County/region metrics rollup.
     */
    @GetMapping("/v1/analytics/regions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AnalyticsService.CountyMetrics>> getCountyMetrics() {
        return ResponseEntity.ok(analyticsService.getCountyMetrics());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Impact & Reach Endpoints (for Leadership Dashboard)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Get overall impact metrics for the Impact & Reach page.
     */
    @GetMapping("/v1/analytics/impact")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AnalyticsService.ImpactMetrics> getImpactMetrics(
            @RequestParam(defaultValue = "12m") String timeRange,
            @RequestParam(required = false) String pillar
    ) {
        return ResponseEntity.ok(analyticsService.getImpactMetrics(timeRange, pillar));
    }

    /**
     * Get impact metrics broken down by pillar.
     */
    @GetMapping("/v1/analytics/impact/by-pillar")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AnalyticsService.PillarImpactMetrics>> getImpactByPillar(
            @RequestParam(defaultValue = "12m") String timeRange
    ) {
        return ResponseEntity.ok(analyticsService.getImpactByPillar(timeRange));
    }

    /**
     * Get impact trends over time.
     */
    @GetMapping("/v1/analytics/impact/trends")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AnalyticsService.ImpactTrendData>> getImpactTrends(
            @RequestParam(defaultValue = "12m") String timeRange,
            @RequestParam(required = false) String pillar
    ) {
        return ResponseEntity.ok(analyticsService.getImpactTrends(timeRange, pillar));
    }

    /**
     * Get geographic reach data by county.
     */
    @GetMapping("/v1/analytics/impact/county-reach")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AnalyticsService.CountyReachData>> getCountyReach(
            @RequestParam(defaultValue = "12m") String timeRange,
            @RequestParam(required = false) String pillar
    ) {
        return ResponseEntity.ok(analyticsService.getCountyReach(timeRange, pillar));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Existing Diagnostic Endpoints (file-based)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Kaplan-Meier time-to-closure survival curves:
     * fleet vs high-risk sites, medians, and closure rates.
     */
    @GetMapping("/analytics/survival-curves")
    public ResponseEntity<String> getSurvivalCurves() {
        return analyticsService.getSurvivalCurves();
    }

    /**
     * EWMA pressure control charts per site:
     * readings, UCL/LCL bands, drift flags, and lead times before spikes.
     */
    @GetMapping("/analytics/pressure-charts")
    public ResponseEntity<String> getPressureCharts() {
        return analyticsService.getPressureCharts();
    }

    /**
     * Rejection rate vs incident count Pearson correlation:
     * scatter points per site and interpretation.
     */
    @GetMapping("/analytics/correlation")
    public ResponseEntity<String> getCorrelation() {
        return analyticsService.getCorrelation();
    }

    /**
     * Logistic regression feature importances:
     * standardised coefficients per feature from the trained model.
     */
    @GetMapping("/analytics/feature-importance")
    public ResponseEntity<String> getFeatureImportance() {
        return analyticsService.getFeatureImportance();
    }

    /**
     * Model backtest report — precision, recall, F1, train/test split,
     * positive rate, and split date. Used by the Analyst dashboard.
     */
    @GetMapping("/backtest")
    public ResponseEntity<String> getBacktest() {
        return analyticsService.getBacktest();
    }
}
