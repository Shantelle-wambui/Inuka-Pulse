package com.inukapulse.beneficiary;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for beneficiary-level dropout risk predictions.
 *
 * Security model:
 *   /summary             → Programme Director, Admin, Analyst, ML Admin
 *   /breakdown/*         → Programme Director, Admin, Analyst, ML Admin
 *   /list                → Programme Director, Analyst, Admin, ML Admin
 *   /top-risk            → Programme Director, Admin, Analyst, ML Admin
 *   /my-caseload         → Case Manager only (scoped to their cohort assignments)
 *   /my-caseload/summary → Case Manager only
 *   /cohort/{id}         → Authenticated (Case Manager assignment check inside)
 *   /{id}                → Authenticated
 */
@RestController
@RequestMapping("/api/beneficiaries/predictions")
@RequiredArgsConstructor
public class BeneficiaryPredictionController {

    private final BeneficiaryPredictionService service;
    private final CaseloadService              caseloadService;

    // ── Programme Director / Admin / Analyst endpoints ────────────────────────

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Map<String, Object>> getSummary() {
        return ResponseEntity.ok(service.getSummary());
    }

    @GetMapping("/breakdown/county")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Map<String, Map<String, Long>>> getBreakdownByCounty() {
        return ResponseEntity.ok(service.getBreakdownByCounty());
    }

    @GetMapping("/breakdown/pillar")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Map<String, Map<String, Long>>> getBreakdownByPillar() {
        return ResponseEntity.ok(service.getBreakdownByPillar());
    }

    /**
     * GET /api/beneficiaries/predictions/top-risk?band=At-Risk&n=20
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

    /**
     * GET /api/beneficiaries/predictions/list
     *      ?band=&county=&pillar=&cohort=&page=0&size=50
     */
    @GetMapping("/list")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN', 'ANALYST', 'ML_ADMIN')")
    public ResponseEntity<Page<BeneficiaryPredictionDto>> getList(
            @RequestParam(required = false) String band,
            @RequestParam(required = false) String county,
            @RequestParam(required = false) String pillar,
            @RequestParam(required = false) String cohort,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(service.getList(band, county, pillar, cohort, page, size));
    }

    // ── Case Manager: my caseload ─────────────────────────────────────────────

    /**
     * GET /api/beneficiaries/predictions/my-caseload
     *
     * Returns all beneficiaries in the cohorts assigned to the calling
     * Case Manager, sorted by dropout probability (highest risk first).
     *
     * The userId is read from the JWT via the auth token's details field
     * (set by JwtAuthFilter). This enforces field-level data scoping —
     * a Case Manager can never see beneficiaries outside their assignments.
     */
    @GetMapping("/my-caseload")
    @PreAuthorize("hasAnyRole('CASE_MANAGER', 'ADMIN')")
    public ResponseEntity<List<BeneficiaryPredictionDto>> getMyCaseload(Authentication auth) {
        Long userId = extractUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(caseloadService.getMyCaseload(userId));
    }

    /**
     * GET /api/beneficiaries/predictions/my-caseload/summary
     *
     * KPI summary for the Case Manager's caseload:
     * total, needsAttention, atRisk, active, cohorts, lastUpdated.
     */
    @GetMapping("/my-caseload/summary")
    @PreAuthorize("hasAnyRole('CASE_MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> getMyCaseloadSummary(Authentication auth) {
        Long userId = extractUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(caseloadService.getMyCaseloadSummary(userId));
    }

    // ── Cohort view (with Case Manager assignment check) ──────────────────────

    /**
     * GET /api/beneficiaries/predictions/cohort/{cohortId}
     *
     * All beneficiaries in a cohort, sorted high-risk first.
     * Case Managers are restricted to their assigned cohorts.
     * Directors, Analysts, and Admins can access any cohort.
     */
    @GetMapping("/cohort/{cohortId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<BeneficiaryPredictionDto>> getByCohort(
            @PathVariable String cohortId,
            Authentication auth) {

        // Case Managers: enforce cohort assignment
        boolean isCaseManager = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_CASE_MANAGER"));
        if (isCaseManager) {
            Long userId = extractUserId(auth);
            if (userId == null || !caseloadService.isAssignedToCohort(userId, cohortId)) {
                return ResponseEntity.status(403).build();
            }
        }

        return ResponseEntity.ok(service.getByCohort(cohortId));
    }

    // ── Single beneficiary ────────────────────────────────────────────────────

    /**
     * GET /api/beneficiaries/predictions/{beneficiaryId}
     *
     * Latest prediction for one beneficiary.
     * Used by the beneficiary detail page.
     */
    @GetMapping("/{beneficiaryId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BeneficiaryPredictionDto> getByBeneficiaryId(
            @PathVariable String beneficiaryId) {
        return service.getByBeneficiaryId(beneficiaryId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Extracts the userId stored in the JWT details by JwtAuthFilter.
     * Returns null if the token doesn't carry a userId (shouldn't happen
     * for tokens issued by this backend, but safe to handle).
     */
    private Long extractUserId(Authentication auth) {
        if (auth instanceof UsernamePasswordAuthenticationToken token) {
            Object details = token.getDetails();
            if (details instanceof Long l) return l;
            if (details instanceof Integer i) return i.longValue();
        }
        return null;
    }
}
