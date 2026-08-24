package com.inukapulse.program;

import com.inukapulse.donor.DonorFundingRepository;
import com.inukapulse.donor.DonorRepository;
import com.inukapulse.site.SiteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ProgramService {

    private final ProgramRepository programRepository;
    private final DonorFundingRepository donorFundingRepository;
    private final DonorRepository donorRepository;
    private final SiteRepository siteRepository;

    public ProgramService(
            ProgramRepository programRepository,
            DonorFundingRepository donorFundingRepository,
            DonorRepository donorRepository,
            SiteRepository siteRepository
    ) {
        this.programRepository = programRepository;
        this.donorFundingRepository = donorFundingRepository;
        this.donorRepository = donorRepository;
        this.siteRepository = siteRepository;
    }

    public List<ProgramDto> getAllPrograms() {
        return programRepository.findAll().stream()
                .map(this::enrichWithMetrics)
                .collect(Collectors.toList());
    }

    public List<ProgramDto> getActivePrograms() {
        return programRepository.findActivePrograms().stream()
                .map(this::enrichWithMetrics)
                .collect(Collectors.toList());
    }

    public Optional<ProgramDto> getProgramById(String programId) {
        return programRepository.findById(programId)
                .map(this::enrichWithMetrics);
    }

    public List<ProgramDto> getProgramsByPillar(String pillar) {
        return programRepository.findByPillar(pillar).stream()
                .map(this::enrichWithMetrics)
                .collect(Collectors.toList());
    }

    public List<ProgramDto> getProgramsByCounty(String county) {
        return programRepository.findByCounty(county).stream()
                .map(this::enrichWithMetrics)
                .collect(Collectors.toList());
    }

    public List<ProgramDto> getProgramsByDonor(String donorId) {
        return programRepository.findProgramsByDonorId(donorId).stream()
                .map(this::enrichWithMetrics)
                .collect(Collectors.toList());
    }

    public List<String> getActiveCounties() {
        return programRepository.findActiveCounties();
    }

    public List<String> getActivePillars() {
        return programRepository.findActivePillars();
    }

    @Transactional
    public ProgramDto createProgram(CreateProgramRequest request) {
        ProgramEntity entity = new ProgramEntity();
        entity.setProgramId(request.programId());
        entity.setPillar(request.pillar());
        entity.setName(request.name());
        entity.setCounty(request.county());
        entity.setStartDate(request.startDate());
        entity.setEndDate(request.endDate());
        entity.setTargetCapacity(request.targetCapacity());
        entity.setStatus(request.status() != null ? request.status() : "planned");
        entity.setDescription(request.description());

        ProgramEntity saved = programRepository.save(entity);
        return ProgramDto.from(saved);
    }

    @Transactional
    public ProgramDto updateProgramStatus(String programId, String status) {
        ProgramEntity entity = programRepository.findById(programId)
                .orElseThrow(() -> new RuntimeException("Program not found: " + programId));
        entity.setStatus(status);
        ProgramEntity saved = programRepository.save(entity);
        return enrichWithMetrics(saved);
    }

    private ProgramDto enrichWithMetrics(ProgramEntity entity) {
        // Get funding data
        BigDecimal totalFunding = donorFundingRepository.sumAmountByProgramId(entity.getProgramId());
        BigDecimal disbursedAmount = donorFundingRepository.sumDisbursedByProgramId(entity.getProgramId());

        // Get cohort count (sites linked to this program)
        long cohortCount = siteRepository.countByProgramId(entity.getProgramId());

        // Get donor names
        List<String> donors = donorFundingRepository.findByProgramId(entity.getProgramId()).stream()
                .map(df -> donorRepository.findById(df.getDonorId()))
                .filter(Optional::isPresent)
                .map(d -> d.get().getName())
                .distinct()
                .collect(Collectors.toList());

        // TODO: Get actual enrollment count from cohort features when available
        Integer currentEnrollment = (int) (cohortCount * 40); // Placeholder estimate

        return ProgramDto.withMetrics(
                entity,
                currentEnrollment,
                totalFunding != null ? totalFunding : BigDecimal.ZERO,
                disbursedAmount != null ? disbursedAmount : BigDecimal.ZERO,
                (int) cohortCount,
                donors
        );
    }
}
