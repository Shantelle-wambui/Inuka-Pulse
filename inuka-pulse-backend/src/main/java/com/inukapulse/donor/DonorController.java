package com.inukapulse.donor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/donors")
public class DonorController {

    private final DonorService donorService;

    public DonorController(DonorService donorService) {
        this.donorService = donorService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN', 'DONOR')")
    public ResponseEntity<List<DonorDto>> getAllDonors(
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly
    ) {
        List<DonorDto> donors = activeOnly 
                ? donorService.getActiveDonors() 
                : donorService.getAllDonors();
        return ResponseEntity.ok(donors);
    }

    @GetMapping("/{donorId}")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<DonorDto> getDonor(@PathVariable String donorId) {
        return donorService.getDonorById(donorId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Donor Portal summary endpoint.
     * Returns aggregated data only - no beneficiary-level PII.
     * 
     * For DONOR role: can only access their own data
     * For ADMIN/EXECUTIVE: can access any donor's data
     */
    @GetMapping("/{donorId}/summary")
    @PreAuthorize("(hasRole('DONOR') and @donorService.canAccessDonor(authentication.name, #donorId)) " +
                  "or hasAnyRole('EXECUTIVE', 'ADMIN')")
    public ResponseEntity<DonorSummaryDto> getDonorSummary(@PathVariable String donorId) {
        return donorService.getDonorSummary(donorId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{donorId}/funding")
    @PreAuthorize("(hasRole('DONOR') and @donorService.canAccessDonor(authentication.name, #donorId)) " +
                  "or hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<DonorFundingEntity>> getDonorFunding(
            @PathVariable String donorId,
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly,
            @RequestParam(required = false) Integer fiscalYear
    ) {
        List<DonorFundingEntity> funding = activeOnly
                ? donorService.getActiveFundingByDonor(donorId)
                : donorService.getFundingByDonor(donorId);
        
        if (fiscalYear != null) {
            funding = funding.stream()
                    .filter(f -> f.getFiscalYear().equals(fiscalYear))
                    .toList();
        }
        return ResponseEntity.ok(funding);
    }

    /**
     * Get all funding records (for aggregate view across all donors).
     */
    @GetMapping("/funding")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<DonorService.FundedProgramDto>> getAllFunding(
            @RequestParam(required = false) Integer fiscalYear
    ) {
        return ResponseEntity.ok(donorService.getAllFunding(fiscalYear));
    }

    /**
     * Get disbursement trends for a specific donor.
     */
    @GetMapping("/{donorId}/trends")
    @PreAuthorize("(hasRole('DONOR') and @donorService.canAccessDonor(authentication.name, #donorId)) " +
                  "or hasAnyRole('EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<DonorService.DisbursementTrend>> getDonorTrends(
            @PathVariable String donorId,
            @RequestParam(required = false) Integer fiscalYear
    ) {
        return ResponseEntity.ok(donorService.getDisbursementTrends(donorId, fiscalYear));
    }

    /**
     * Get aggregate disbursement trends (across all donors).
     */
    @GetMapping("/trends")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<DonorService.DisbursementTrend>> getAllDonorTrends(
            @RequestParam(required = false) Integer fiscalYear
    ) {
        return ResponseEntity.ok(donorService.getDisbursementTrends(null, fiscalYear));
    }
}
