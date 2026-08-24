package com.inukapulse.allocation;

import com.inukapulse.program.ProgramEntity;
import com.inukapulse.program.ProgramRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for resource allocation management and Model 5 (Allocation Optimization) integration.
 * 
 * Model 5 is NOT a trained ML model - it's a transparent weighted scoring formula
 * over the outputs of Models 2-4 (Demand, Reach, Outcome).
 */
@Service
@Transactional(readOnly = true)
public class AllocationService {

    private final ResourceAllocationRepository allocationRepository;
    private final ProgramRepository programRepository;

    // Default weights for the allocation scoring formula (configurable)
    private static final BigDecimal W_DEMAND = new BigDecimal("0.30");
    private static final BigDecimal W_CAPACITY_GAP = new BigDecimal("0.25");
    private static final BigDecimal W_OUTCOME_RISK = new BigDecimal("0.25");
    private static final BigDecimal W_FUNDING_GAP = new BigDecimal("0.20");

    public AllocationService(
            ResourceAllocationRepository allocationRepository,
            ProgramRepository programRepository
    ) {
        this.allocationRepository = allocationRepository;
        this.programRepository = programRepository;
    }

    public List<AllocationRecommendation> getPendingRecommendations() {
        return getPendingRecommendations(null, null);
    }

    public List<AllocationRecommendation> getPendingRecommendations(String resourceType, String region) {
        List<ResourceAllocationEntity> allocations = allocationRepository.findMlRecommendations();
        
        return allocations.stream()
                .filter(a -> resourceType == null || a.getResourceType().equals(resourceType))
                .filter(a -> region == null || a.getRegion().equals(region))
                .map(this::toRecommendation)
                .collect(Collectors.toList());
    }

    /**
     * Get allocation statistics summary.
     */
    public AllocationStats getAllocationStats() {
        int pending = allocationRepository.findMlRecommendations().size();
        int approvedThisMonth = (int) allocationRepository.findAll().stream()
                .filter(a -> "approved".equals(a.getStatus()))
                .filter(a -> a.getApprovedAt() != null && a.getApprovedAt().isAfter(LocalDateTime.now().minusDays(30)))
                .count();
        int rejectedThisMonth = (int) allocationRepository.findAll().stream()
                .filter(a -> "rejected".equals(a.getStatus()))
                .filter(a -> a.getApprovedAt() != null && a.getApprovedAt().isAfter(LocalDateTime.now().minusDays(30)))
                .count();
        
        BigDecimal avgConfidence = allocationRepository.findMlRecommendations().stream()
                .map(ResourceAllocationEntity::getPriorityScore)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(Math.max(pending, 1)), 4, java.math.RoundingMode.HALF_UP)
                .divide(new BigDecimal("100"), 4, java.math.RoundingMode.HALF_UP);
        
        BigDecimal totalReallocation = allocationRepository.findMlRecommendations().stream()
                .filter(a -> "budget".equals(a.getResourceType()))
                .map(ResourceAllocationEntity::getAllocatedAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        return new AllocationStats(pending, approvedThisMonth, rejectedThisMonth, avgConfidence, totalReallocation);
    }

    /**
     * Get region summary for allocations dashboard.
     */
    public List<RegionSummary> getRegionSummary() {
        List<ProgramEntity> activePrograms = programRepository.findActivePrograms();
        Map<String, List<ProgramEntity>> byCounty = activePrograms.stream()
                .collect(Collectors.groupingBy(ProgramEntity::getCounty));
        
        return byCounty.entrySet().stream()
                .map(e -> {
                    String county = e.getKey();
                    List<ProgramEntity> programs = e.getValue();
                    int programCount = programs.size();
                    long totalBeneficiaries = programs.stream()
                            .mapToLong(p -> p.getTargetCapacity() != null ? p.getTargetCapacity().longValue() : 0)
                            .sum();
                    
                    // Placeholder metrics - in production would come from actual data
                    BigDecimal avgDropoutRisk = new BigDecimal("0.25").add(new BigDecimal(Math.random() * 0.15));
                    BigDecimal demandGrowth = new BigDecimal("5.0").add(new BigDecimal(Math.random() * 10 - 5));
                    BigDecimal foCoverage = new BigDecimal("70").add(new BigDecimal(Math.random() * 20));
                    BigDecimal budgetUtilization = new BigDecimal("75").add(new BigDecimal(Math.random() * 15));
                    
                    return new RegionSummary(
                            county,
                            programCount,
                            totalBeneficiaries,
                            avgDropoutRisk.setScale(2, java.math.RoundingMode.HALF_UP),
                            demandGrowth.setScale(1, java.math.RoundingMode.HALF_UP),
                            foCoverage.setScale(0, java.math.RoundingMode.HALF_UP),
                            budgetUtilization.setScale(0, java.math.RoundingMode.HALF_UP)
                    );
                })
                .sorted((a, b) -> Long.compare(b.totalBeneficiaries(), a.totalBeneficiaries()))
                .collect(Collectors.toList());
    }

    public List<ResourceAllocationEntity> getAllocationsByProgram(String programId) {
        return allocationRepository.findActiveAndPendingByProgram(programId);
    }

    public List<ResourceAllocationEntity> getActiveAllocations() {
        return allocationRepository.findActiveAllocations(LocalDate.now());
    }

    public Optional<ResourceAllocationEntity> getAllocationById(String id) {
        return allocationRepository.findById(id);
    }

    /**
     * Generate allocation recommendations using Model 5 scoring formula.
     * This is called by the ETL pipeline after Models 2-4 produce their forecasts.
     */
    @Transactional
    public List<AllocationRecommendation> generateRecommendations() {
        List<AllocationRecommendation> recommendations = new ArrayList<>();

        // Get all active programs grouped by county
        Map<String, List<ProgramEntity>> programsByCounty = programRepository.findActivePrograms().stream()
                .collect(Collectors.groupingBy(ProgramEntity::getCounty));

        for (Map.Entry<String, List<ProgramEntity>> entry : programsByCounty.entrySet()) {
            String county = entry.getKey();
            List<ProgramEntity> programs = entry.getValue();

            // Group by pillar within county
            Map<String, List<ProgramEntity>> programsByPillar = programs.stream()
                    .collect(Collectors.groupingBy(ProgramEntity::getPillar));

            for (Map.Entry<String, List<ProgramEntity>> pillarEntry : programsByPillar.entrySet()) {
                String pillar = pillarEntry.getKey();
                
                // Compute priority score using the transparent formula
                AllocationRecommendation rec = computeAllocationPriority(county, pillar);
                if (rec.priorityScore().compareTo(new BigDecimal("30")) > 0) {
                    recommendations.add(rec);
                    
                    // Create a pending allocation record
                    createPendingAllocation(rec, pillarEntry.getValue().get(0));
                }
            }
        }

        // Sort by priority score descending
        recommendations.sort((a, b) -> b.priorityScore().compareTo(a.priorityScore()));
        return recommendations;
    }

    /**
     * Model 5: Transparent weighted scoring formula for allocation priority.
     * 
     * Formula: priority = w1·demand_score + w2·capacity_gap_score + w3·outcome_risk_score - w4·funding_penalty
     * 
     * This is NOT a trained model - it's an explainable formula over other models' outputs.
     */
    public AllocationRecommendation computeAllocationPriority(String county, String pillar) {
        // Get model outputs (placeholders - in production would come from fact_predictions)
        BigDecimal demandForecast = getDemandForecast(county, pillar);
        BigDecimal currentCapacity = getCurrentCapacity(county, pillar);
        BigDecimal capacityUtilization = getCapacityUtilization(county, pillar);
        BigDecimal outcomeRisk = getOutcomeRiskScore(county, pillar);
        BigDecimal fundingGap = getFundingGap(county, pillar);

        // Normalize to 0-100 scale
        BigDecimal demandScore = demandForecast.divide(currentCapacity.max(BigDecimal.ONE), 4, java.math.RoundingMode.HALF_UP)
                .multiply(new BigDecimal("50"))
                .min(new BigDecimal("100"));
        
        BigDecimal capacityGapScore = BigDecimal.ONE.subtract(capacityUtilization)
                .multiply(new BigDecimal("100"))
                .max(BigDecimal.ZERO);
        
        BigDecimal riskScore = outcomeRisk.multiply(new BigDecimal("100"));
        
        BigDecimal fundingPenalty = fundingGap.divide(new BigDecimal("1000000"), 4, java.math.RoundingMode.HALF_UP)
                .multiply(new BigDecimal("10"))
                .min(new BigDecimal("50"));

        // Compute priority
        BigDecimal priority = W_DEMAND.multiply(demandScore)
                .add(W_CAPACITY_GAP.multiply(capacityGapScore))
                .add(W_OUTCOME_RISK.multiply(riskScore))
                .subtract(W_FUNDING_GAP.multiply(fundingPenalty));

        // Build component breakdown for transparency
        Map<String, BigDecimal> components = new LinkedHashMap<>();
        components.put("demand_contribution", W_DEMAND.multiply(demandScore).setScale(2, java.math.RoundingMode.HALF_UP));
        components.put("capacity_gap_contribution", W_CAPACITY_GAP.multiply(capacityGapScore).setScale(2, java.math.RoundingMode.HALF_UP));
        components.put("outcome_risk_contribution", W_OUTCOME_RISK.multiply(riskScore).setScale(2, java.math.RoundingMode.HALF_UP));
        components.put("funding_penalty", W_FUNDING_GAP.multiply(fundingPenalty).setScale(2, java.math.RoundingMode.HALF_UP));

        // Generate human-readable rationale
        String rationale = generateRationale(demandScore, capacityGapScore, riskScore, fundingPenalty);

        return new AllocationRecommendation(
                null,
                county,
                pillar,
                priority.setScale(2, java.math.RoundingMode.HALF_UP),
                components,
                rationale,
                "pending"
        );
    }

    @Transactional
    public ResourceAllocationEntity approveAllocation(String id, String approvedBy, AllocationApprovalRequest request) {
        ResourceAllocationEntity allocation = allocationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Allocation not found: " + id));

        if (!"pending".equals(allocation.getStatus())) {
            throw new RuntimeException("Allocation is not pending: " + allocation.getStatus());
        }

        // Apply adjustments if provided
        if (request.adjustedAmount() != null) {
            allocation.setAllocatedAmount(request.adjustedAmount());
        }

        allocation.setStatus("approved");
        allocation.setApprovedBy(approvedBy);
        allocation.setApprovedAt(LocalDateTime.now());

        return allocationRepository.save(allocation);
    }

    @Transactional
    public ResourceAllocationEntity rejectAllocation(String id, String rejectedBy, String reason) {
        ResourceAllocationEntity allocation = allocationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Allocation not found: " + id));

        allocation.setStatus("rejected");
        allocation.setApprovedBy(rejectedBy);
        allocation.setApprovedAt(LocalDateTime.now());
        allocation.setRationale(allocation.getRationale() + " | REJECTED: " + reason);

        return allocationRepository.save(allocation);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void createPendingAllocation(AllocationRecommendation rec, ProgramEntity program) {
        ResourceAllocationEntity entity = new ResourceAllocationEntity();
        entity.setId("alloc-" + UUID.randomUUID().toString().substring(0, 8));
        entity.setProgramId(program.getProgramId());
        entity.setRegion(rec.county());
        entity.setResourceType("training_capacity");
        entity.setAllocatedAmount(new BigDecimal("50")); // Default recommendation
        entity.setUnit("seats");
        entity.setPeriodStart(LocalDate.now());
        entity.setPeriodEnd(LocalDate.now().plusMonths(3));
        entity.setSource("ml_recommended");
        entity.setPriorityScore(rec.priorityScore());
        entity.setRationale(rec.rationale());
        entity.setStatus("pending");

        allocationRepository.save(entity);
    }

    private AllocationRecommendation toRecommendation(ResourceAllocationEntity entity) {
        // Parse components from rationale if stored (simplified for now)
        Map<String, BigDecimal> components = new LinkedHashMap<>();
        
        return new AllocationRecommendation(
                entity.getId(),
                entity.getRegion(),
                null, // Pillar would need to be derived from program
                entity.getPriorityScore(),
                components,
                entity.getRationale(),
                entity.getStatus()
        );
    }

    private String generateRationale(BigDecimal demand, BigDecimal capacity, BigDecimal risk, BigDecimal funding) {
        List<String> factors = new ArrayList<>();
        
        if (demand.compareTo(new BigDecimal("60")) > 0) {
            factors.add("high projected demand");
        }
        if (capacity.compareTo(new BigDecimal("40")) > 0) {
            factors.add("significant unused capacity");
        }
        if (risk.compareTo(new BigDecimal("50")) > 0) {
            factors.add("elevated outcome risk");
        }
        if (funding.compareTo(new BigDecimal("20")) > 0) {
            factors.add("funding shortfall");
        }

        if (factors.isEmpty()) {
            return "Moderate priority across all factors.";
        }

        return "Priority driven by: " + String.join(", ", factors) + ".";
    }

    // Placeholder methods - in production would read from fact_predictions
    private BigDecimal getDemandForecast(String county, String pillar) {
        return new BigDecimal("150"); // Placeholder
    }

    private BigDecimal getCurrentCapacity(String county, String pillar) {
        return new BigDecimal("200"); // Placeholder
    }

    private BigDecimal getCapacityUtilization(String county, String pillar) {
        return new BigDecimal("0.75"); // Placeholder
    }

    private BigDecimal getOutcomeRiskScore(String county, String pillar) {
        return new BigDecimal("0.35"); // Placeholder
    }

    private BigDecimal getFundingGap(String county, String pillar) {
        return new BigDecimal("500000"); // Placeholder
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public record AllocationRecommendation(
            String id,
            String county,
            String pillar,
            BigDecimal priorityScore,
            Map<String, BigDecimal> components,
            String rationale,
            String status
    ) {}

    public record AllocationApprovalRequest(
            BigDecimal adjustedAmount,
            String notes
    ) {}

    public record AllocationStats(
            Integer pendingRecommendations,
            Integer approvedThisMonth,
            Integer rejectedThisMonth,
            BigDecimal avgConfidenceScore,
            BigDecimal totalReallocationValue
    ) {}

    public record RegionSummary(
            String region,
            Integer programs,
            Long totalBeneficiaries,
            BigDecimal avgDropoutRisk,
            BigDecimal demandGrowth,
            BigDecimal fieldOfficerCoverage,
            BigDecimal budgetUtilization
    ) {}
}
