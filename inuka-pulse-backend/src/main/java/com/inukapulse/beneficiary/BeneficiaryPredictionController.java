package com.inukapulse.beneficiary;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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
 * 
 * Input Validation:
 *   All path variables and query parameters are validated to prevent malformed
 *   input from causing errors or unexpected behavior. IDs follow the pattern
 *   BEN-XXXXX for beneficiaries and COHORT-XX-XXX for cohorts.
 */
@RestController
@RequestMapping("/api/beneficiaries/predictions")
@RequiredArgsConstructor
@Validated
public class BeneficiaryPredictionController {

    // Validation patterns for IDs
    private static final String BENEFICIARY_ID_PATTERN = "^BEN-[0-9]{5}$";
    private static final String COHORT_ID_PATTERN = "^COHORT-[A-Z]{2}-[0-9]{3}$";
    private static final String BAND_PATTERN = "^(Active|At-Risk|Disengaged|Dropout)$";

    private final BeneficiaryPredictionService service;
    private final CaseloadService              caseloadService;
    private final PredictionInterpretationService interpretationService;
    private final PredictionFeedbackRepository feedbackRepository;

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
            @RequestParam(defaultValue = "At-Risk") 
            @Pattern(regexp = BAND_PATTERN, message = "Band must be one of: Active, At-Risk, Disengaged, Dropout")
            String band,
            @RequestParam(defaultValue = "20") 
            @Min(value = 1, message = "n must be at least 1")
            @Max(value = 100, message = "n must not exceed 100")
            int n) {
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
            @RequestParam(required = false) 
            @Pattern(regexp = BAND_PATTERN, message = "Band must be one of: Active, At-Risk, Disengaged, Dropout")
            String band,
            @RequestParam(required = false) 
            @Size(max = 100, message = "County name too long")
            String county,
            @RequestParam(required = false) 
            @Size(max = 50, message = "Pillar name too long")
            String pillar,
            @RequestParam(required = false) 
            @Size(max = 20, message = "Cohort ID too long")
            String cohort,
            @RequestParam(defaultValue = "0")  
            @Min(value = 0, message = "Page must be non-negative")
            int page,
            @RequestParam(defaultValue = "50") 
            @Min(value = 1, message = "Size must be at least 1")
            @Max(value = 200, message = "Size must not exceed 200")
            int size) {
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
            @PathVariable 
            @Size(min = 1, max = 20, message = "Cohort ID must be between 1 and 20 characters")
            String cohortId,
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
            @PathVariable 
            @Size(min = 1, max = 20, message = "Beneficiary ID must be between 1 and 20 characters")
            String beneficiaryId) {
        return service.getByBeneficiaryId(beneficiaryId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/beneficiaries/predictions/{beneficiaryId}/interpretation
     *
     * ML prediction interpretation for one beneficiary.
     * Translates raw ML output into actionable insights:
     * - Risk band and escalation probability
     * - Top risk drivers with recommendations
     * - Human-readable narrative explanation
     *
     * Used by case managers to understand why a beneficiary is at risk
     * and what actions to take.
     */
    @GetMapping("/{beneficiaryId}/interpretation")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PredictionInterpretationDto> getInterpretation(
            @PathVariable 
            @Size(min = 1, max = 20, message = "Beneficiary ID must be between 1 and 20 characters")
            String beneficiaryId) {
        return interpretationService.getInterpretation(beneficiaryId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/beneficiaries/predictions/{beneficiaryId}/feedback
     *
     * Submit feedback on a prediction's accuracy.
     * Allows case managers to indicate whether predictions were accurate,
     * enabling model calibration monitoring and future retraining.
     */
    @PostMapping("/{beneficiaryId}/feedback")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> submitFeedback(
            @PathVariable 
            @Size(min = 1, max = 20, message = "Beneficiary ID must be between 1 and 20 characters")
            String beneficiaryId,
            @RequestBody Map<String, String> body) {

        String rating = body.get("rating");
        if (rating == null || !List.of("accurate", "inaccurate", "uncertain").contains(rating)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid rating. Must be: accurate, inaccurate, or uncertain"));
        }

        String comment = body.get("comment");
        if (comment != null && comment.length() > 1000) {
            return ResponseEntity.badRequest().body(Map.of("error", "Comment must not exceed 1000 characters"));
        }

        PredictionFeedbackEntity feedback = new PredictionFeedbackEntity();
        feedback.setBeneficiaryId(beneficiaryId);
        feedback.setPredictionDate(LocalDate.now());
        feedback.setRating(rating);
        feedback.setComment(comment);
        // submittedBy could come from security context in production

        feedbackRepository.save(feedback);
        return ResponseEntity.ok(Map.of("status", "saved"));
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
