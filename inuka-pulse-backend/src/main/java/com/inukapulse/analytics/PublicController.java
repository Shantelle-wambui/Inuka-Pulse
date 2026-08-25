package com.inukapulse.analytics;

import com.inukapulse.program.ProgramRepository;
import com.inukapulse.site.SiteRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Public API endpoints for Foundation website integration.
 * 
 * These endpoints:
 * - Require NO authentication
 * - Return ONLY aggregated, non-PII data
 * - Are cached for 5 minutes (CDN-friendly)
 * - Are rate-limited (configured in SecurityConfig)
 */
@RestController
@RequestMapping("/api/v1/public")
@CrossOrigin(origins = "*", maxAge = 3600) // Allow CORS for website embed
public class PublicController {

    private final ProgramRepository programRepository;
    private final SiteRepository siteRepository;
    private final DashboardMetricsRepository metricsRepository;

    public PublicController(
            ProgramRepository programRepository,
            SiteRepository siteRepository,
            DashboardMetricsRepository metricsRepository
    ) {
        this.programRepository = programRepository;
        this.siteRepository = siteRepository;
        this.metricsRepository = metricsRepository;
    }

    /**
     * Public impact summary for Foundation website.
     * 
     * Contains ONLY aggregate metrics - NO beneficiary names, IDs, or PII.
     * Designed to be embedded via iframe or fetched by public website.
     */
    @GetMapping("/impact-summary")
    public ResponseEntity<PublicImpactSummary> getImpactSummary() {
        // Compute aggregate metrics
        long totalPrograms = programRepository.findActivePrograms().size();
        long totalCohorts = siteRepository.count();
        
        // Pillar breakdown
        Map<String, Long> reachByPillar = new HashMap<>();
        for (String pillar : programRepository.findActivePillars()) {
            long pillarPrograms = programRepository.findByPillar(pillar).size();
            // Estimate reach based on programs (placeholder - would use actual enrollment data)
            reachByPillar.put(pillar, pillarPrograms * 150);
        }

        // County coverage
        int countiesCovered = programRepository.findActiveCounties().size();

        // Total reach (sum of pillar reach)
        long totalReach = reachByPillar.values().stream().mapToLong(Long::longValue).sum();

        // Placeholder metrics - in production would come from measurement table
        BigDecimal completionRate = new BigDecimal("76.8");
        BigDecimal employmentRate = new BigDecimal("68.5");

        PublicImpactSummary summary = new PublicImpactSummary(
                totalReach,
                reachByPillar,
                countiesCovered,
                completionRate,
                employmentRate,
                totalPrograms,
                LocalDateTime.now()
        );

        // Cache for 5 minutes
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(summary);
    }

    /**
     * Pillar summary for public display.
     */
    @GetMapping("/pillars")
    public ResponseEntity<Map<String, PillarPublicSummary>> getPillarSummary() {
        Map<String, PillarPublicSummary> pillars = new HashMap<>();
        
        for (String pillar : programRepository.findActivePillars()) {
            long programCount = programRepository.findByPillar(pillar).size();
            // Placeholder metrics
            pillars.put(pillar, new PillarPublicSummary(
                    pillar,
                    programCount,
                    programCount * 150, // Estimated beneficiaries
                    new BigDecimal("75.0") // Placeholder completion rate
            ));
        }

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(pillars);
    }

    // ── Response DTOs (no PII) ────────────────────────────────────────────────

    public record PublicImpactSummary(
            Long totalReach,
            Map<String, Long> reachByPillar,
            Integer countiesCovered,
            BigDecimal overallCompletionRate,
            BigDecimal employmentRate,
            Long activePrograms,
            LocalDateTime lastUpdated
    ) {}

    public record PillarPublicSummary(
            String pillar,
            Long programCount,
            Long beneficiariesReached,
            BigDecimal completionRate
    ) {}
}
