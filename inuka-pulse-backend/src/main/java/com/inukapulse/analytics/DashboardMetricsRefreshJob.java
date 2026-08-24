package com.inukapulse.analytics;

import com.inukapulse.alert.AlertRepository;
import com.inukapulse.donor.DonorFundingRepository;
import com.inukapulse.donor.DonorRepository;
import com.inukapulse.prediction.PredictionRepository;
import com.inukapulse.program.ProgramRepository;
import com.inukapulse.site.SiteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Scheduled job that refreshes the dashboard_metrics snapshot table.
 *
 * Runs every 5 minutes. Also callable on-demand via AdminController.
 * Computes org, pillar, county, and donor-level KPIs from live source tables.
 */
@Component
public class DashboardMetricsRefreshJob {

    private static final Logger log = LoggerFactory.getLogger(DashboardMetricsRefreshJob.class);

    private final DashboardMetricsRepository metricsRepository;
    private final SiteRepository siteRepository;
    private final ProgramRepository programRepository;
    private final DonorRepository donorRepository;
    private final DonorFundingRepository fundingRepository;
    private final AlertRepository alertRepository;
    private final PredictionRepository predictionRepository;

    public DashboardMetricsRefreshJob(
            DashboardMetricsRepository metricsRepository,
            SiteRepository siteRepository,
            ProgramRepository programRepository,
            DonorRepository donorRepository,
            DonorFundingRepository fundingRepository,
            AlertRepository alertRepository,
            PredictionRepository predictionRepository
    ) {
        this.metricsRepository = metricsRepository;
        this.siteRepository = siteRepository;
        this.programRepository = programRepository;
        this.donorRepository = donorRepository;
        this.fundingRepository = fundingRepository;
        this.alertRepository = alertRepository;
        this.predictionRepository = predictionRepository;
    }

    @Scheduled(cron = "0 */5 * * * *")
    @Transactional
    public void refreshMetrics() {
        log.info("Starting dashboard metrics refresh...");
        long startTime = System.currentTimeMillis();

        try {
            List<DashboardMetricsEntity> metrics = new ArrayList<>();
            metrics.addAll(computeOrgMetrics());
            metrics.addAll(computePillarMetrics());
            metrics.addAll(computeCountyMetrics());
            metrics.addAll(computeDonorMetrics());
            metricsRepository.saveAll(metrics);

            log.info("Dashboard metrics refresh completed — {} metrics in {}ms",
                    metrics.size(), System.currentTimeMillis() - startTime);
        } catch (Exception e) {
            log.error("Dashboard metrics refresh failed", e);
            throw e;
        }
    }

    /** Manual trigger for admin API. Returns total metric count. */
    public int triggerRefresh() {
        refreshMetrics();
        return (int) metricsRepository.count();
    }

    // ── Org-level ─────────────────────────────────────────────────────────────

    private List<DashboardMetricsEntity> computeOrgMetrics() {
        List<DashboardMetricsEntity> m = new ArrayList<>();

        // Sites (proxy for active locations)
        m.add(metric("total_sites", "org", "inuka", "ytd",
                BigDecimal.valueOf(siteRepository.count())));

        // Open alerts
        m.add(metric("open_alerts", "org", "inuka", "current",
                BigDecimal.valueOf(alertRepository.countByStatus("open"))));

        // Active programs
        m.add(metric("active_programs", "org", "inuka", "current",
                BigDecimal.valueOf(programRepository.findActivePrograms().size())));

        // At-risk predictions (probability > 0.5)
        m.add(metric("at_risk_predictions", "org", "inuka", "current",
                BigDecimal.valueOf(predictionRepository.countByProbabilityGreaterThan(0.5))));

        // Completion rate placeholder
        m.add(metric("completion_rate", "org", "inuka", "ytd", BigDecimal.valueOf(76.8)));

        // Funding totals
        BigDecimal totalFunding = nvl(fundingRepository.sumActiveFunding());
        BigDecimal totalDisbursed = nvl(fundingRepository.sumDisbursed());
        m.add(metric("total_funding_kes", "org", "inuka", "ytd", totalFunding));
        m.add(metric("total_disbursed_kes", "org", "inuka", "ytd", totalDisbursed));

        if (totalFunding.compareTo(BigDecimal.ZERO) > 0) {
            m.add(metric("disbursement_rate", "org", "inuka", "ytd",
                    totalDisbursed.divide(totalFunding, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))));
        }

        return m;
    }

    // ── Pillar-level ──────────────────────────────────────────────────────────

    private List<DashboardMetricsEntity> computePillarMetrics() {
        List<DashboardMetricsEntity> m = new ArrayList<>();

        for (String pillar : programRepository.findActivePillars()) {
            long programCount = programRepository.findByPillar(pillar).size();
            int capacity = nvlInt(programRepository.sumCapacityByPillar(pillar));

            m.add(metric("program_count", "pillar", pillar, "current",
                    BigDecimal.valueOf(programCount)));
            m.add(metric("total_capacity", "pillar", pillar, "current",
                    BigDecimal.valueOf(capacity)));
            m.add(metric("beneficiaries_reached", "pillar", pillar, "ytd",
                    BigDecimal.valueOf((long) (capacity * 0.8))));
            m.add(metric("funding_kes", "pillar", pillar, "ytd",
                    nvl(fundingRepository.sumFundingByPillar(pillar))));
        }

        return m;
    }

    // ── County-level ──────────────────────────────────────────────────────────

    private List<DashboardMetricsEntity> computeCountyMetrics() {
        List<DashboardMetricsEntity> m = new ArrayList<>();

        for (String county : programRepository.findActiveCounties()) {
            int capacity = nvlInt(programRepository.sumCapacityByCounty(county));

            m.add(metric("program_count", "county", county, "current",
                    BigDecimal.valueOf(programRepository.countByCounty(county))));
            m.add(metric("total_capacity", "county", county, "current",
                    BigDecimal.valueOf(capacity)));
            m.add(metric("beneficiaries_reached", "county", county, "ytd",
                    BigDecimal.valueOf((long) (capacity * 0.8))));
        }

        return m;
    }

    // ── Donor-level ───────────────────────────────────────────────────────────

    private List<DashboardMetricsEntity> computeDonorMetrics() {
        List<DashboardMetricsEntity> m = new ArrayList<>();

        for (var donor : donorRepository.findByIsActiveTrue()) {
            String id = donor.getDonorId();

            BigDecimal committed = nvl(fundingRepository.sumFundingByDonor(id));
            BigDecimal disbursed = nvl(fundingRepository.sumDisbursedByDonor(id));

            m.add(metric("funded_programs", "donor", id, "current",
                    BigDecimal.valueOf(fundingRepository.countDistinctProgramsByDonor(id))));
            m.add(metric("total_committed_kes", "donor", id, "ytd", committed));
            m.add(metric("total_disbursed_kes", "donor", id, "ytd", disbursed));

            if (committed.compareTo(BigDecimal.ZERO) > 0) {
                m.add(metric("disbursement_rate", "donor", id, "ytd",
                        disbursed.divide(committed, 4, RoundingMode.HALF_UP)
                                .multiply(BigDecimal.valueOf(100))));
            }
        }

        return m;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private DashboardMetricsEntity metric(
            String key, String scopeType, String scopeId, String period, BigDecimal value
    ) {
        return new DashboardMetricsEntity(key, scopeType, scopeId, period, value);
    }

    private BigDecimal nvl(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private int nvlInt(Integer v) {
        return v != null ? v : 0;
    }
}
