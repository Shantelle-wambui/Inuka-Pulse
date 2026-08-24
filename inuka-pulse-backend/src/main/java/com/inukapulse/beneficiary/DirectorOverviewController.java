package com.inukapulse.beneficiary;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST endpoints for the Programme Director's deeper dashboard views.
 *
 * GET /api/director/overview          → all Phase 4 data in one call
 * GET /api/director/risk-trend        → band counts per snapshot date
 * GET /api/director/interventions     → follow-up stats
 * GET /api/director/welfare-concerns  → open/closed welfare concern counts
 *
 * All endpoints require Programme Director or Admin role.
 */
@RestController
@RequestMapping("/api/director")
@RequiredArgsConstructor
public class DirectorOverviewController {

    private final DirectorOverviewService service;

    /**
     * GET /api/director/overview
     *
     * Single endpoint that returns all Director deeper-view data:
     *   riskTrend, interventions, welfareConcerns
     *
     * Used by the Director dashboard to load Phase 4 panels in one fetch.
     */
    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> getOverview() {
        return ResponseEntity.ok(service.getDirectorOverview());
    }

    /**
     * GET /api/director/risk-trend
     *
     * Risk band counts per prediction snapshot date, ordered ascending.
     * Returns dates[], snapshotCount, series[], hasMultipleSnapshots.
     *
     * Used by: Director risk trend line chart.
     * Note: becomes meaningful after ≥2 pipeline runs.
     */
    @GetMapping("/risk-trend")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Map<String, Object>> getRiskTrend() {
        return ResponseEntity.ok(service.getRiskTrend());
    }

    /**
     * GET /api/director/interventions
     *
     * Programme-level follow-up statistics:
     *   totalFollowUps, uniqueBeneficiariesContacted, last30Days,
     *   byOutcome, byContactType, escalatedCount
     *
     * Used by: Director intervention summary panel.
     */
    @GetMapping("/interventions")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'COORDINATOR')")
    public ResponseEntity<Map<String, Object>> getInterventions() {
        return ResponseEntity.ok(service.getInterventionSummary());
    }

    /**
     * GET /api/director/welfare-concerns
     *
     * Open/closed hazard report counts.
     * Used by: Director welfare concern summary card.
     */
    @GetMapping("/welfare-concerns")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'COORDINATOR')")
    public ResponseEntity<Map<String, Object>> getWelfareConcerns() {
        return ResponseEntity.ok(service.getWelfareSummary());
    }
}
