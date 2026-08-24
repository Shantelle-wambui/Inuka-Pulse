package com.inukapulse.beneficiary;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * REST endpoints for beneficiary follow-up actions.
 *
 * GET  /api/beneficiaries/{beneficiaryId}/follow-ups
 *      → History of all follow-ups for a beneficiary (authenticated)
 *
 * POST /api/beneficiaries/{beneficiaryId}/follow-ups
 *      → Record a new follow-up (Case Manager or Admin only)
 *      → Uses JWT userId to set officer_id automatically
 */
@RestController
@RequestMapping("/api/beneficiaries/{beneficiaryId}/follow-ups")
@RequiredArgsConstructor
public class BeneficiaryFollowUpController {

    private final BeneficiaryFollowUpRepository repository;

    /**
     * GET /api/beneficiaries/{beneficiaryId}/follow-ups
     *
     * Returns the full follow-up history for a beneficiary, newest first.
     * Available to any authenticated user (Case Managers, Directors, Analysts).
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<BeneficiaryFollowUpDto>> getHistory(
            @PathVariable String beneficiaryId) {

        List<BeneficiaryFollowUpDto> history = repository
                .findByBeneficiaryIdOrderByFollowUpDateDescCreatedAtDesc(beneficiaryId)
                .stream()
                .map(BeneficiaryFollowUpDto::from)
                .toList();

        return ResponseEntity.ok(history);
    }

    /**
     * POST /api/beneficiaries/{beneficiaryId}/follow-ups
     *
     * Records a new follow-up action for a beneficiary.
     * The officer_id is set from the JWT — the Case Manager cannot record
     * a follow-up as someone else.
     *
     * Required fields: contactType, outcome
     * Optional fields: notes, followUpDate (defaults to today), nextAction
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('CASE_MANAGER', 'ADMIN', 'COORDINATOR')")
    public ResponseEntity<BeneficiaryFollowUpDto> record(
            @PathVariable String beneficiaryId,
            @RequestBody RecordFollowUpRequest req,
            Authentication auth) {

        Long officerId = extractUserId(auth);
        if (officerId == null) return ResponseEntity.status(401).build();

        LocalDate date;
        try {
            date = req.getFollowUpDate() != null
                    ? LocalDate.parse(req.getFollowUpDate())
                    : LocalDate.now();
        } catch (Exception e) {
            date = LocalDate.now();
        }

        BeneficiaryFollowUpEntity entity = new BeneficiaryFollowUpEntity();
        entity.setBeneficiaryId(beneficiaryId);
        entity.setOfficerId(officerId);
        entity.setContactType(req.getContactType() != null ? req.getContactType() : "other");
        entity.setOutcome(req.getOutcome() != null ? req.getOutcome() : "reached");
        entity.setNotes(req.getNotes());
        entity.setFollowUpDate(date);
        entity.setNextAction(req.getNextAction());

        BeneficiaryFollowUpEntity saved = repository.save(entity);
        return ResponseEntity.ok(BeneficiaryFollowUpDto.from(saved));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private Long extractUserId(Authentication auth) {
        if (auth instanceof UsernamePasswordAuthenticationToken token) {
            Object details = token.getDetails();
            if (details instanceof Long l)    return l;
            if (details instanceof Integer i) return i.longValue();
        }
        return null;
    }
}
