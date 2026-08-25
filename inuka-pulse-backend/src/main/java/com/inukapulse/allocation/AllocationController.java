package com.inukapulse.allocation;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller for Resource Allocation endpoints.
 * Supports Model 5 (Allocation Optimization) workflow.
 */
@RestController
@RequestMapping("/api/v1/allocations")
public class AllocationController {

    private final AllocationService allocationService;

    public AllocationController(AllocationService allocationService) {
        this.allocationService = allocationService;
    }

    /**
     * Get ML-recommended allocations pending review.
     * These are Model 5 outputs awaiting Leadership approval.
     */
    @GetMapping("/recommendations")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<AllocationService.AllocationRecommendation>> getRecommendations(
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String region
    ) {
        return ResponseEntity.ok(allocationService.getPendingRecommendations(resourceType, region));
    }

    /**
     * Get allocation statistics summary.
     */
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<AllocationService.AllocationStats> getStats() {
        return ResponseEntity.ok(allocationService.getAllocationStats());
    }

    /**
     * Get regional summary for allocations.
     */
    @GetMapping("/region-summary")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<AllocationService.RegionSummary>> getRegionSummary() {
        return ResponseEntity.ok(allocationService.getRegionSummary());
    }

    /**
     * Get all allocations for a specific program.
     */
    @GetMapping("/by-program/{programId}")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<ResourceAllocationEntity>> getAllocationsByProgram(
            @PathVariable String programId
    ) {
        return ResponseEntity.ok(allocationService.getAllocationsByProgram(programId));
    }

    /**
     * Get currently active allocations.
     */
    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<ResourceAllocationEntity>> getActiveAllocations() {
        return ResponseEntity.ok(allocationService.getActiveAllocations());
    }

    /**
     * Get a specific allocation by ID.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<ResourceAllocationEntity> getAllocation(@PathVariable String id) {
        return allocationService.getAllocationById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Approve an ML-recommended allocation.
     * Model 5 outputs ALWAYS require human approval - never auto-execute.
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE')")
    public ResponseEntity<ResourceAllocationEntity> approveAllocation(
            @PathVariable String id,
            @RequestBody(required = false) AllocationService.AllocationApprovalRequest request,
            Authentication authentication
    ) {
        String approvedBy = authentication.getName();
        ResourceAllocationEntity approved = allocationService.approveAllocation(
                id, 
                approvedBy, 
                request != null ? request : new AllocationService.AllocationApprovalRequest(null, null)
        );
        return ResponseEntity.ok(approved);
    }

    /**
     * Reject an ML-recommended allocation.
     */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('PROGRAM_MANAGER', 'EXECUTIVE')")
    public ResponseEntity<ResourceAllocationEntity> rejectAllocation(
            @PathVariable String id,
            @RequestParam String reason,
            Authentication authentication
    ) {
        String rejectedBy = authentication.getName();
        ResourceAllocationEntity rejected = allocationService.rejectAllocation(id, rejectedBy, reason);
        return ResponseEntity.ok(rejected);
    }

    /**
     * Manually trigger recommendation generation.
     * In production, this would be called by the ETL pipeline.
     */
    @PostMapping("/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AllocationService.AllocationRecommendation>> generateRecommendations() {
        return ResponseEntity.ok(allocationService.generateRecommendations());
    }
}
