package com.inukapulse.beneficiary;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for beneficiary-level dropout risk predictions.
 *
 * Security:
 *   /summary      → Programme Director, Admin (programme-level overview)
 *   /breakdown/*  → Programme Director, Admin
 *   /list         → Programme Director, Analyst, Admin (full population view)
 *   /{id}         → Any authenticated user (individual lookup)
 *   /cohort/{id}  → Case Manager, Programme Director, Admin (caseload view)
 *
 * Field-level security (e.g. limiting Case Managers to their assigned cohort)
 * will be enforced in Phase 3 once officer-beneficiary assignment is built.
 */
@RestController
@RequestMapping("/api/beneficiaries/predictions")
@RequiredArgsConstructor
public class BeneficiaryPredictionController {

    private final BeneficiaryPredictionService service;

    // ── Programme Director / Admin endpoints ─────────────────────────────────

    /**
     * GET /api/beneficiaries/predictions/summary
     *
     * Returns band counts (total, active, atRisk, disengaged, dropout),
     * last updated date, and available county/pillar filter values.
     *
     * Used by: Director KPI strip, Analyst overview.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Map<String, Object>> getSummary() {
        return ResponseEntity.ok(service.getSummary());
    }

    /**
     * GET /api/beneficiaries/predictions/breakdown/county
     *
     * Band breakdown per county — used by Director county comparison chart.
     */
    @GetMapping("/breakdown/county")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Map<String, Map<String, Long>>> getBreakdownByCounty() {
        return ResponseEntity.ok(service.getBreakdownByCounty());
    }

    /**
     * GET /api/beneficiaries/predictions/breakdown/pillar
     *
     * Band breakdown per pillar — used by Director pillar comparison chart.
     */
    @GetMapping("/breakdown/pillar")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Map<String, Map<String, Long>>> getBreakdownByPillar() {
        return ResponseEntity.ok(service.getBreakdownByPillar());
    }

    /**
     * GET /api/beneficiaries/predictions/top-risk?band=At-Risk&n=20
     *
     * Top N highest-risk beneficiaries for a given band.
     * Used by Director "most at-risk" and "predicted dropout" panels.
     */
    @GetMapping("/top-risk")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<List<BeneficiaryPredictionDto>> getTopRisk(
            @RequestParam(defaultValue = "At-Risk") String band,
            @RequestParam(defaultValue = "20")      int    n) {
        List<BeneficiaryPredictionDto> results = "Dropout".equals(band)
                ? service.getTopDropout(n)
                : service.getTopAtRisk(n);
        return ResponseEntity.ok(results);
    }

    // ── Full list (Analyst / Director) ────────────────────────────────────────

    /**
     * GET /api/beneficiaries/predictions/list
     *      ?band=At-Risk&county=Nairobi&pillar=Scholarship&cohort=COHORT-SC-001
     *      &page=0&size=50
     *
     * Paginated, filterable list of all beneficiary predictions.
     * All query params are optional.
     */
    @GetMapping("/list")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Page<BeneficiaryPredictionDto>> getList(
            @RequestParam(required = false) String band,
            @RequestParam(required = false) String county,
            @RequestParam(required = false) String pillar,
            @RequestParam(required = false) String cohort,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "50")  int size) {
        return ResponseEntity.ok(service.getList(band, county, pillar, cohort, page, size));
    }

    // ── Case Manager caseload ─────────────────────────────────────────────────

    /**
     * GET /api/beneficiaries/predictions/cohort/{cohortId}
     *
     * All beneficiaries in a specific cohort, sorted high-risk first.
     * Used by Case Manager dashboard caseload view.
     *
     * TODO Phase 3: enforce that the requesting Case Manager is assigned
     * to this cohort. Currently any authenticated user can access any cohort.
     */
    @GetMapping("/cohort/{cohortId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<BeneficiaryPredictionDto>> getByCohort(
            @PathVariable String cohortId) {
        return ResponseEntity.ok(service.getByCohort(cohortId));
    }

    // ── Single beneficiary ────────────────────────────────────────────────────

    /**
     * GET /api/beneficiaries/predictions/{beneficiaryId}
     *
     * Latest prediction for one beneficiary.
     * Used by Case Manager beneficiary detail page.
     */
    @GetMapping("/{beneficiaryId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BeneficiaryPredictionDto> getByBeneficiaryId(
            @PathVariable String beneficiaryId) {
        return service.getByBeneficiaryId(beneficiaryId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
