package com.inukapulse.donor;

import com.inukapulse.program.ProgramEntity;
import com.inukapulse.program.ProgramRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class DonorService {

    private final DonorRepository donorRepository;
    private final DonorFundingRepository donorFundingRepository;
    private final ProgramRepository programRepository;

    public DonorService(
            DonorRepository donorRepository,
            DonorFundingRepository donorFundingRepository,
            ProgramRepository programRepository
    ) {
        this.donorRepository = donorRepository;
        this.donorFundingRepository = donorFundingRepository;
        this.programRepository = programRepository;
    }

    public List<DonorDto> getAllDonors() {
        return donorRepository.findAll().stream()
                .map(this::enrichWithSummary)
                .collect(Collectors.toList());
    }

    public List<DonorDto> getActiveDonors() {
        return donorRepository.findAllActiveDonors().stream()
                .map(this::enrichWithSummary)
                .collect(Collectors.toList());
    }

    public Optional<DonorDto> getDonorById(String donorId) {
        return donorRepository.findById(donorId)
                .map(this::enrichWithSummary);
    }

    /**
     * Get donor summary for the Donor Portal view.
     * This contains only aggregated data - no beneficiary-level PII.
     */
    public Optional<DonorSummaryDto> getDonorSummary(String donorId) {
        return donorRepository.findById(donorId)
                .map(this::buildDonorSummary);
    }

    /**
     * Check if a user can access a specific donor's data.
     * Used for authorization in the controller.
     */
    public boolean canAccessDonor(String userId, String donorId) {
        // TODO: Implement proper donor-user mapping from auth system
        // For now, return true if donor exists
        return donorRepository.existsById(donorId);
    }

    public List<DonorFundingEntity> getFundingByDonor(String donorId) {
        return donorFundingRepository.findByDonorId(donorId);
    }

    public List<DonorFundingEntity> getActiveFundingByDonor(String donorId) {
        return donorFundingRepository.findActiveFundingByDonorId(donorId);
    }

    private DonorDto enrichWithSummary(DonorEntity entity) {
        Long programCount = donorFundingRepository.countProgramsByDonorId(entity.getDonorId());
        BigDecimal totalCommitment = donorFundingRepository.sumAmountByDonorId(entity.getDonorId());
        BigDecimal totalDisbursed = donorFundingRepository.sumDisbursedByDonorId(entity.getDonorId());

        return DonorDto.withSummary(
                entity,
                programCount,
                totalCommitment != null ? totalCommitment : BigDecimal.ZERO,
                totalDisbursed != null ? totalDisbursed : BigDecimal.ZERO
        );
    }

    private DonorSummaryDto buildDonorSummary(DonorEntity donor) {
        List<DonorFundingEntity> fundingList = donorFundingRepository.findByDonorId(donor.getDonorId());
        
        // Calculate funding totals
        BigDecimal totalCommitment = fundingList.stream()
                .map(DonorFundingEntity::getAmountKes)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        BigDecimal totalDisbursed = fundingList.stream()
                .map(DonorFundingEntity::getDisbursedToDate)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        BigDecimal disbursementRate = totalCommitment.compareTo(BigDecimal.ZERO) > 0
                ? totalDisbursed.divide(totalCommitment, 4, java.math.RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        
        BigDecimal fundingGap = totalCommitment.subtract(totalDisbursed);

        // Build program summaries
        List<DonorSummaryDto.FundedProgramSummary> programSummaries = new ArrayList<>();
        Map<String, BigDecimal> pillarFunding = new HashMap<>();
        Map<String, Long> pillarProgramCount = new HashMap<>();

        for (DonorFundingEntity funding : fundingList) {
            Optional<ProgramEntity> programOpt = programRepository.findById(funding.getProgramId());
            if (programOpt.isPresent()) {
                ProgramEntity program = programOpt.get();
                
                BigDecimal rate = funding.getAmountKes().compareTo(BigDecimal.ZERO) > 0
                        ? funding.getDisbursedToDate().divide(funding.getAmountKes(), 4, java.math.RoundingMode.HALF_UP).multiply(new BigDecimal("100"))
                        : BigDecimal.ZERO;

                programSummaries.add(new DonorSummaryDto.FundedProgramSummary(
                        program.getProgramId(),
                        program.getName(),
                        program.getPillar(),
                        program.getCounty(),
                        program.getStatus(),
                        funding.getAmountKes(),
                        funding.getDisbursedToDate(),
                        rate,
                        (long) (program.getTargetCapacity() * 0.8), // Placeholder: 80% of capacity
                        new BigDecimal("75.5") // Placeholder completion rate
                ));

                // Aggregate by pillar
                pillarFunding.merge(program.getPillar(), funding.getAmountKes(), BigDecimal::add);
                pillarProgramCount.merge(program.getPillar(), 1L, Long::sum);
            }
        }

        // Build pillar breakdown
        List<DonorSummaryDto.PillarSummary> pillarBreakdown = pillarFunding.entrySet().stream()
                .map(entry -> new DonorSummaryDto.PillarSummary(
                        entry.getKey(),
                        pillarProgramCount.getOrDefault(entry.getKey(), 0L),
                        entry.getValue(),
                        0L // TODO: Get actual beneficiary count
                ))
                .collect(Collectors.toList());

        // Calculate reach metrics (placeholders - would come from actual enrollment data)
        long totalBeneficiariesReached = programSummaries.stream()
                .mapToLong(DonorSummaryDto.FundedProgramSummary::beneficiariesServed)
                .sum();

        return new DonorSummaryDto(
                donor.getDonorId(),
                donor.getName(),
                (long) fundingList.size(),
                totalCommitment,
                totalDisbursed,
                disbursementRate,
                fundingGap,
                totalBeneficiariesReached,
                (long) (totalBeneficiariesReached * 0.85), // Active = 85% of total (placeholder)
                new BigDecimal("76.3"), // Placeholder average completion rate
                programSummaries,
                pillarBreakdown
        );
    }

    /**
     * Get all funding records with program details for dashboard.
     */
    public List<FundedProgramDto> getAllFunding(Integer fiscalYear) {
        List<DonorFundingEntity> allFunding = donorFundingRepository.findAll();
        
        if (fiscalYear != null) {
            allFunding = allFunding.stream()
                    .filter(f -> f.getFiscalYear().equals(fiscalYear))
                    .toList();
        }
        
        return allFunding.stream()
                .map(funding -> {
                    Optional<ProgramEntity> programOpt = programRepository.findById(funding.getProgramId());
                    Optional<DonorEntity> donorOpt = donorRepository.findById(funding.getDonorId());
                    
                    String programName = programOpt.map(ProgramEntity::getName).orElse("Unknown");
                    String pillar = programOpt.map(ProgramEntity::getPillar).orElse("Unknown");
                    String county = programOpt.map(ProgramEntity::getCounty).orElse("Unknown");
                    String donorName = donorOpt.map(DonorEntity::getName).orElse("Unknown");
                    
                    long beneficiariesReached = programOpt
                            .map(p -> (long) (p.getTargetCapacity() * 0.8))
                            .orElse(0L);
                    
                    BigDecimal completionRate = new BigDecimal("75.5"); // Placeholder
                    
                    return new FundedProgramDto(
                            funding.getProgramId(),
                            programName,
                            pillar,
                            county,
                            donorName,
                            funding.getAmountKes(),
                            funding.getDisbursedToDate(),
                            funding.getFiscalYear(),
                            funding.getFundingStatus(),
                            beneficiariesReached,
                            completionRate
                    );
                })
                .toList();
    }

    /**
     * Get disbursement trends by month for charts.
     */
    public List<DisbursementTrend> getDisbursementTrends(String donorId, Integer fiscalYear) {
        // Generate monthly trend data (placeholder - would come from actual disbursement history)
        String[] months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        List<DisbursementTrend> trends = new ArrayList<>();
        
        // Get base amounts from funding records
        List<DonorFundingEntity> funding = donorId != null 
                ? donorFundingRepository.findByDonorId(donorId)
                : donorFundingRepository.findAll();
        
        if (fiscalYear != null) {
            funding = funding.stream()
                    .filter(f -> f.getFiscalYear().equals(fiscalYear))
                    .toList();
        }
        
        BigDecimal totalCommitted = funding.stream()
                .map(DonorFundingEntity::getAmountKes)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        BigDecimal totalDisbursed = funding.stream()
                .map(DonorFundingEntity::getDisbursedToDate)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        // Distribute across months (simple linear for demo)
        BigDecimal monthlyCommitted = totalCommitted.divide(new BigDecimal("12"), 0, java.math.RoundingMode.HALF_UP);
        BigDecimal cumulativeDisbursed = BigDecimal.ZERO;
        BigDecimal avgMonthlyDisbursement = totalDisbursed.divide(new BigDecimal("12"), 0, java.math.RoundingMode.HALF_UP);
        
        for (int i = 0; i < 12; i++) {
            // Add some variance
            BigDecimal variance = avgMonthlyDisbursement.multiply(new BigDecimal(0.9 + Math.random() * 0.2));
            cumulativeDisbursed = cumulativeDisbursed.add(variance);
            
            // Cap at total disbursed
            if (cumulativeDisbursed.compareTo(totalDisbursed) > 0) {
                cumulativeDisbursed = totalDisbursed;
            }
            
            trends.add(new DisbursementTrend(
                    months[i],
                    variance.setScale(0, java.math.RoundingMode.HALF_UP),
                    monthlyCommitted
            ));
        }
        
        return trends;
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public record FundedProgramDto(
            String programId,
            String programName,
            String pillar,
            String county,
            String donorName,
            BigDecimal amountKes,
            BigDecimal disbursedToDate,
            Integer fiscalYear,
            String fundingStatus,
            Long beneficiariesReached,
            BigDecimal completionRate
    ) {}

    public record DisbursementTrend(
            String month,
            BigDecimal disbursed,
            BigDecimal committed
    ) {}
}
