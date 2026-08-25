package com.inukapulse.analytics;

import com.inukapulse.alert.AlertRepository;
import com.inukapulse.beneficiary.BeneficiaryPredictionRepository;
import com.inukapulse.donor.DonorFundingRepository;
import com.inukapulse.program.ProgramRepository;
import com.inukapulse.site.SiteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Serves pre-computed diagnostic JSON files and real-time KPI metrics.
 *
 * Combines:
 * 1. File-based diagnostics from Python pipeline (survival, correlation, etc.)
 * 2. Real-time KPIs from dashboard_metrics table
 * 3. Live aggregations from beneficiary_prediction, program, donor_funding tables
 *
 * All impact/reach/trend/county methods now query actual data rather than
 * returning hardcoded values or Random(42)-seeded synthetic figures.
 */
@Service
@Slf4j
public class AnalyticsService {

    /** Reuses the same pipeline-dir config as EtlReloadService. */
    @Value("${inuka.etl.pipeline-dir:../inuka-pipeline}")
    private String sentinelDir;

    private static final String WAREHOUSE = "data/warehouse";

    // ── File names — Inuka pipeline artifacts ────────────────────────────────
    private static final String SURVIVAL_FILE         = "inuka_survival_curve_data.json";
    private static final String CONTROL_CHART_FILE    = "inuka_control_chart_data.json";
    private static final String CORRELATION_FILE      = "inuka_correlation_data.json";
    private static final String FEATURE_IMPORT_FILE   = "inuka_feature_importance.json";
    private static final String BACKTEST_FILE         = "inuka_backtest_report.json";
    private static final String ROI_REFERENCE_FILE    = "inuka_roi_reference.json";
    private static final String ROI_SIMULATION_FILE   = "roi_simulation_result.json";
    private static final String ROI_REFERENCE_DIR     = "data/reference";
    // Phase 5 — Analyst deeper views
    private static final String OUTCOME_METRICS_FILE  = "outcome_model_metrics.json";
    private static final String OUTCOME_PREDS_FILE    = "outcome_predictions.json";

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MMM yyyy");

    private final DashboardMetricsRepository metricsRepository;
    private final ProgramRepository programRepository;
    private final SiteRepository siteRepository;
    private final AlertRepository alertRepository;
    private final BeneficiaryPredictionRepository predictionRepository;
    private final DonorFundingRepository fundingRepository;

    public AnalyticsService(
            DashboardMetricsRepository metricsRepository,
            ProgramRepository programRepository,
            SiteRepository siteRepository,
            AlertRepository alertRepository,
            BeneficiaryPredictionRepository predictionRepository,
            DonorFundingRepository fundingRepository
    ) {
        this.metricsRepository = metricsRepository;
        this.programRepository = programRepository;
        this.siteRepository = siteRepository;
        this.alertRepository = alertRepository;
        this.predictionRepository = predictionRepository;
        this.fundingRepository = fundingRepository;
    }

    // ── KPI Strip API ────────────────────────────────────────────────────────

    public KpiResponse getKpis(String scope, String scopeId) {
        if (scope == null || scope.isBlank()) {
            scope = "org";
        }
        if (scopeId == null || scopeId.isBlank()) {
            scopeId = "inuka";
        }

        List<DashboardMetricsEntity> metrics = metricsRepository.findByScopeAndPeriod(scope, scopeId, "current");

        // If no metrics in DB, compute from live data
        if (metrics.isEmpty()) {
            return computeLiveKpis(scope, scopeId);
        }

        // Convert to response format
        Map<String, MetricValue> metricMap = metrics.stream()
                .collect(Collectors.toMap(
                        DashboardMetricsEntity::getMetricKey,
                        m -> new MetricValue(m.getValue(), m.getPreviousValue(), m.getChangePct(), m.getTrendDirection())
                ));

        LocalDateTime lastUpdated = metricsRepository.findLastUpdated().orElse(LocalDateTime.now());

        return new KpiResponse(
                metricMap.getOrDefault("total_beneficiaries", MetricValue.empty()).value().longValue(),
                metricMap.getOrDefault("active_beneficiaries", MetricValue.empty()).value().longValue(),
                metricMap.getOrDefault("at_risk_cohorts", MetricValue.empty()).value().intValue(),
                metricMap.getOrDefault("completion_rate", MetricValue.empty()).value(),
                metricMap.getOrDefault("total_reach", MetricValue.empty()).value().longValue(),
                metricMap.getOrDefault("total_funding", MetricValue.empty()).value(),
                metricMap.getOrDefault("disbursed_amount", MetricValue.empty()).value(),
                lastUpdated
        );
    }

    private KpiResponse computeLiveKpis(String scope, String scopeId) {
        // Beneficiary counts from the latest prediction snapshot
        Map<String, Long> bandCounts = buildBandCountMap(predictionRepository.countByBand());
        long totalBeneficiaries = bandCounts.values().stream().mapToLong(Long::longValue).sum();
        long activeBeneficiaries = bandCounts.getOrDefault("Active", 0L);
        long atRiskCount = bandCounts.getOrDefault("At-Risk", 0L);

        // At-risk cohorts = distinct cohorts that have at least one At-Risk or Disengaged beneficiary
        // Approximation: use active alert count capped at total cohort count
        long totalCohorts = siteRepository.count();
        long activeAlerts = alertRepository.countByStatus("active");
        int atRiskCohorts = (int) Math.min(activeAlerts, totalCohorts);

        // Completion rate: Active / total (if data exists), else 0
        BigDecimal completionRate = totalBeneficiaries > 0
                ? BigDecimal.valueOf(activeBeneficiaries * 100.0 / totalBeneficiaries).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Funding from donor_funding table
        BigDecimal totalFunding = Optional.ofNullable(fundingRepository.sumActiveFunding()).orElse(BigDecimal.ZERO);
        BigDecimal disbursed    = Optional.ofNullable(fundingRepository.sumDisbursed()).orElse(BigDecimal.ZERO);

        return new KpiResponse(
                totalBeneficiaries,
                activeBeneficiaries,
                atRiskCohorts,
                completionRate,
                totalBeneficiaries,   // reach = total enrolled
                totalFunding,
                disbursed,
                LocalDateTime.now()
        );
    }

    public List<PillarMetrics> getPillarMetrics() {
        List<String> pillars = programRepository.findActivePillars();
        return pillars.stream()
                .map(this::computePillarMetrics)
                .collect(Collectors.toList());
    }

    private PillarMetrics computePillarMetrics(String pillar) {
        long programCount = programRepository.findByPillar(pillar).size();
        long cohortCount = siteRepository.findAllWithProgram().stream()
                .filter(s -> {
                    var program = programRepository.findById(s.getProgramId());
                    return program.isPresent() && pillar.equals(program.get().getPillar());
                })
                .count();

        // Real beneficiary count from prediction snapshot for this pillar
        Map<String, Long> bandCounts = buildBandCountMap(predictionRepository.countByBandForPillar(pillar));
        long beneficiaryCount = bandCounts.values().stream().mapToLong(Long::longValue).sum();
        long atRiskCount = bandCounts.getOrDefault("At-Risk", 0L) + bandCounts.getOrDefault("Disengaged", 0L);

        // Completion rate: Active / total beneficiaries in this pillar
        long active = bandCounts.getOrDefault("Active", 0L);
        BigDecimal completionRate = beneficiaryCount > 0
                ? BigDecimal.valueOf(active * 100.0 / beneficiaryCount).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new PillarMetrics(
                pillar,
                programCount,
                cohortCount,
                beneficiaryCount,
                completionRate,
                (int) atRiskCount
        );
    }

    public List<CountyMetrics> getCountyMetrics() {
        List<String> counties = programRepository.findActiveCounties();
        return counties.stream()
                .map(this::computeCountyMetrics)
                .collect(Collectors.toList());
    }

    private CountyMetrics computeCountyMetrics(String county) {
        long programCount = programRepository.findByCounty(county).size();

        // Real beneficiary count for this county from prediction snapshot
        Map<String, Long> bandCounts = buildBandCountMap(predictionRepository.countByBandForCounty(county));
        long beneficiaryCount = bandCounts.values().stream().mapToLong(Long::longValue).sum();
        long atRiskCount = bandCounts.getOrDefault("At-Risk", 0L) + bandCounts.getOrDefault("Disengaged", 0L);

        // Capacity utilization: enrolled / target_capacity for this county
        Integer targetCapacity = programRepository.sumCapacityByCounty(county);
        BigDecimal capacityUtilization = (targetCapacity != null && targetCapacity > 0 && beneficiaryCount > 0)
                ? BigDecimal.valueOf(beneficiaryCount * 100.0 / targetCapacity).setScale(1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new CountyMetrics(
                county,
                programCount,
                beneficiaryCount,
                capacityUtilization,
                null,          // demand forecast — requires separate forecasting model
                (int) atRiskCount
        );
    }

    // ── Diagnostics File API (existing) ──────────────────────────────────────

    public ResponseEntity<String> getSurvivalCurves() {
        return readJson(SURVIVAL_FILE);
    }

    public ResponseEntity<String> getPressureCharts() {
        return readJson(CONTROL_CHART_FILE);
    }

    public ResponseEntity<String> getCorrelation() {
        return readJson(CORRELATION_FILE);
    }

    public ResponseEntity<String> getFeatureImportance() {
        return readJson(FEATURE_IMPORT_FILE);
    }

    public ResponseEntity<String> getBacktest() {
        return readJson(BACKTEST_FILE);
    }

    public ResponseEntity<String> getOutcomeMetrics() {
        return readJson(OUTCOME_METRICS_FILE);
    }

    public ResponseEntity<String> getOutcomePredictions() {
        return readJson(OUTCOME_PREDS_FILE);
    }

    public ResponseEntity<String> getRoiReferenceCase() {
        Path filePath = Paths.get(sentinelDir, ROI_REFERENCE_DIR, ROI_REFERENCE_FILE).toAbsolutePath();
        if (!Files.exists(filePath)) {
            String fallback = "{\"description\":\"Inuka Foundation — programme investment ROI assumptions\"," +
                "\"default_assumptions\":[" +
                "{\"key\":\"interventionProbability\",\"label\":\"Intervention success probability\",\"value\":0.70,\"unit\":\"0-1\",\"sourceType\":\"ESTIMATE\",\"editable\":true}," +
                "{\"key\":\"costPerDropoutKes\",\"label\":\"Cost per dropout (re-enrolment + lost investment)\",\"value\":85000,\"unit\":\"KES\",\"sourceType\":\"ESTIMATE\",\"editable\":true}," +
                "{\"key\":\"nHighRiskBeneficiaries\",\"label\":\"High-risk beneficiaries (period)\",\"value\":12,\"unit\":\"count\",\"sourceType\":\"PIPELINE_DATA\",\"editable\":true}" +
                "]}";
            return ResponseEntity.ok().header("Content-Type", "application/json").body(fallback);
        }
        try {
            String content = Files.readString(filePath);
            return ResponseEntity.ok().header("Content-Type", "application/json").body(content);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("{\"error\":\"read_error\"}");
        }
    }

    public ResponseEntity<String> getRoiSimulationResult() {
        return readJson(ROI_SIMULATION_FILE);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Impact & Reach Methods (Leadership Dashboard) — live DB queries
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Overall impact metrics computed from beneficiary_prediction + donor_funding.
     *
     * Band mapping:
     *   Active      → enrolled and active
     *   At-Risk     → enrolled but flagged
     *   Disengaged  → enrolled but disengaging
     *   Dropout     → dropped out (treated as "completed negatively" for cost calc)
     *
     * Completion rate = Active / (Active + At-Risk + Disengaged + Dropout)
     * Cost per beneficiary = total active funding / total beneficiaries (if > 0)
     */
    public ImpactMetrics getImpactMetrics(String timeRange, String pillar) {
        List<Object[]> rawBands = (pillar != null && !pillar.isBlank())
                ? predictionRepository.countByBandForPillar(pillar)
                : predictionRepository.countByBand();

        Map<String, Long> bandCounts = buildBandCountMap(rawBands);
        long active      = bandCounts.getOrDefault("Active", 0L);
        long atRisk      = bandCounts.getOrDefault("At-Risk", 0L);
        long disengaged  = bandCounts.getOrDefault("Disengaged", 0L);
        long dropout     = bandCounts.getOrDefault("Dropout", 0L);
        long total       = active + atRisk + disengaged + dropout;

        // Funding from donor_funding
        BigDecimal totalFunding = (pillar != null && !pillar.isBlank())
                ? Optional.ofNullable(fundingRepository.sumFundingByPillar(pillar)).orElse(BigDecimal.ZERO)
                : Optional.ofNullable(fundingRepository.sumActiveFunding()).orElse(BigDecimal.ZERO);

        // Derived rates — all from real counts
        BigDecimal completionRate = rate(active, total);
        BigDecimal retentionRate  = rate(active + atRisk, total);   // retained = not yet dropped
        BigDecimal dropoutRate    = rate(dropout, total);

        // Cost per beneficiary — if we have both funding and beneficiary data
        BigDecimal costPerBeneficiary = (total > 0 && totalFunding.compareTo(BigDecimal.ZERO) > 0)
                ? totalFunding.divide(BigDecimal.valueOf(total), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Cost per positive outcome (active completers)
        BigDecimal costPerOutcome = (active > 0 && totalFunding.compareTo(BigDecimal.ZERO) > 0)
                ? totalFunding.divide(BigDecimal.valueOf(active), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Trend deltas: compare latest snapshot band counts to previous snapshot
        TrendDeltas deltas = computeTrendDeltas(pillar);

        return new ImpactMetrics(
                total,
                active,
                dropout,                     // completedBeneficiaries mapped to dropout (known exits)
                completionRate,
                deltas.completionRateDelta(),
                BigDecimal.ZERO,             // employmentRate — no employment table yet; honest zero
                BigDecimal.ZERO,             // employmentRateTrend
                retentionRate,
                deltas.retentionRateDelta(),
                null,                        // avgTimeToCompletion — requires enrollment date table
                costPerBeneficiary,
                costPerOutcome
        );
    }

    /**
     * Impact metrics broken down by every active pillar.
     * Replaces the static hardcoded List.of(Scholarship, Plus, ...).
     */
    public List<PillarImpactMetrics> getImpactByPillar(String timeRange) {
        // Build a county→beneficiaryCount map from the latest snapshot
        Map<String, Long> pillarTotals = new LinkedHashMap<>();
        for (Object[] row : predictionRepository.countDistinctBeneficiariesByPillar()) {
            String pillar = (String) row[0];
            long count = ((Number) row[1]).longValue();
            pillarTotals.put(pillar, count);
        }

        return programRepository.findActivePillars().stream()
                .map(pillar -> {
                    long beneficiaryCount = pillarTotals.getOrDefault(pillar, 0L);

                    Map<String, Long> bandCounts = buildBandCountMap(
                            predictionRepository.countByBandForPillar(pillar));
                    long active = bandCounts.getOrDefault("Active", 0L);
                    long total  = bandCounts.values().stream().mapToLong(Long::longValue).sum();

                    BigDecimal completionRate = rate(active, total);

                    BigDecimal fundingForPillar = Optional
                            .ofNullable(fundingRepository.sumFundingByPillar(pillar))
                            .orElse(BigDecimal.ZERO);
                    BigDecimal costPerBeneficiary = (beneficiaryCount > 0 && fundingForPillar.compareTo(BigDecimal.ZERO) > 0)
                            ? fundingForPillar.divide(BigDecimal.valueOf(beneficiaryCount), 0, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;

                    return new PillarImpactMetrics(
                            pillar,
                            (int) beneficiaryCount,
                            completionRate,
                            BigDecimal.ZERO,     // employmentRate — no employment table yet
                            costPerBeneficiary
                    );
                })
                .collect(Collectors.toList());
    }

    /**
     * Impact trends over time — real snapshot dates from beneficiary_prediction.
     *
     * Each data point is one prediction snapshot date.
     * enrolled  = total predictions in that snapshot
     * completed = Active band in that snapshot
     * employed  = null (no employment table — returned as 0, not fake random data)
     * retained  = Active + At-Risk (not yet disengaged/dropped)
     *
     * If fewer than 2 snapshots exist, returns what data is available.
     */
    public List<ImpactTrendData> getImpactTrends(String timeRange, String pillar) {
        List<Object[]> rawTrend = (pillar != null && !pillar.isBlank())
                ? predictionRepository.countByBandPerDateForPillar(pillar)
                : predictionRepository.countByBandPerDate();

        // Group by date → band → count
        Map<LocalDate, Map<String, Long>> byDate = new LinkedHashMap<>();
        for (Object[] row : rawTrend) {
            LocalDate date = (LocalDate) row[0];
            String band    = (String) row[1];
            long count     = ((Number) row[2]).longValue();
            byDate.computeIfAbsent(date, d -> new HashMap<>()).put(band, count);
        }

        return byDate.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    LocalDate date      = entry.getKey();
                    Map<String, Long> b = entry.getValue();
                    long active      = b.getOrDefault("Active", 0L);
                    long atRisk      = b.getOrDefault("At-Risk", 0L);
                    long disengaged  = b.getOrDefault("Disengaged", 0L);
                    long dropout     = b.getOrDefault("Dropout", 0L);
                    long enrolled    = active + atRisk + disengaged + dropout;
                    long retained    = active + atRisk;

                    return new ImpactTrendData(
                            date.format(MONTH_FMT),
                            (int) enrolled,
                            (int) dropout,     // "completed" mapped to known exits
                            0,                 // employed — no employment data yet (honest 0)
                            (int) retained
                    );
                })
                .collect(Collectors.toList());
    }

    /**
     * Geographic reach by county — computed from beneficiary_prediction latest snapshot.
     * Replaces the 15-county hardcoded static list.
     *
     * completionRate = Active beneficiaries / total in that county
     * growthRate     = null (requires two time periods; returned as 0 — no fake data)
     */
    public List<CountyReachData> getCountyReach(String timeRange, String pillar) {
        // Build county → total beneficiary count from latest snapshot
        Map<String, Long> countyTotals = new LinkedHashMap<>();
        for (Object[] row : predictionRepository.countDistinctBeneficiariesByCounty()) {
            String county = (String) row[0];
            long count    = ((Number) row[1]).longValue();
            countyTotals.put(county, count);
        }

        return countyTotals.entrySet().stream()
                .filter(e -> pillar == null || pillar.isBlank() || isPillarInCounty(e.getKey(), pillar))
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> {
                    String county         = entry.getKey();
                    long totalInCounty    = entry.getValue();

                    Map<String, Long> bandCounts = buildBandCountMap(
                            predictionRepository.countByBandForCounty(county));
                    long active = bandCounts.getOrDefault("Active", 0L);

                    BigDecimal completionRate = rate(active, totalInCounty);

                    return new CountyReachData(
                            county,
                            (int) totalInCounty,
                            completionRate,
                            BigDecimal.ZERO   // growthRate — requires historical comparison; honest zero
                    );
                })
                .collect(Collectors.toList());
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Converts a List<Object[]> of [band, count] rows into a Map<String, Long>.
     */
    private Map<String, Long> buildBandCountMap(List<Object[]> rows) {
        Map<String, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            String band = (String) row[0];
            long count  = ((Number) row[1]).longValue();
            if (band != null) {
                map.put(band, count);
            }
        }
        return map;
    }

    /**
     * Calculates (numerator / denominator) * 100 as BigDecimal(1dp), returns 0 if denominator is 0.
     */
    private BigDecimal rate(long numerator, long denominator) {
        if (denominator == 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(numerator * 100.0 / denominator).setScale(1, RoundingMode.HALF_UP);
    }

    /**
     * Computes delta (change) in completion rate and retention rate between the
     * two most recent prediction snapshots. Returns zeros if fewer than 2 snapshots exist.
     */
    private TrendDeltas computeTrendDeltas(String pillar) {
        List<LocalDate> dates = predictionRepository.findDistinctDates();
        if (dates.size() < 2) {
            return new TrendDeltas(BigDecimal.ZERO, BigDecimal.ZERO);
        }

        LocalDate latest   = dates.get(dates.size() - 1);
        LocalDate previous = dates.get(dates.size() - 2);

        // We use countByBandPerDate and filter — avoids extra repo queries
        List<Object[]> allTrend = (pillar != null && !pillar.isBlank())
                ? predictionRepository.countByBandPerDateForPillar(pillar)
                : predictionRepository.countByBandPerDate();

        Map<String, Long> latestBands   = new HashMap<>();
        Map<String, Long> previousBands = new HashMap<>();

        for (Object[] row : allTrend) {
            LocalDate date = (LocalDate) row[0];
            String band    = (String) row[1];
            long count     = ((Number) row[2]).longValue();
            if (date.equals(latest))   latestBands.put(band, count);
            if (date.equals(previous)) previousBands.put(band, count);
        }

        BigDecimal latestCompletion   = completionRateFromBands(latestBands);
        BigDecimal previousCompletion = completionRateFromBands(previousBands);
        BigDecimal latestRetention    = retentionRateFromBands(latestBands);
        BigDecimal previousRetention  = retentionRateFromBands(previousBands);

        return new TrendDeltas(
                latestCompletion.subtract(previousCompletion).setScale(1, RoundingMode.HALF_UP),
                latestRetention.subtract(previousRetention).setScale(1, RoundingMode.HALF_UP)
        );
    }

    private BigDecimal completionRateFromBands(Map<String, Long> bands) {
        long active = bands.getOrDefault("Active", 0L);
        long total  = bands.values().stream().mapToLong(Long::longValue).sum();
        return rate(active, total);
    }

    private BigDecimal retentionRateFromBands(Map<String, Long> bands) {
        long retained = bands.getOrDefault("Active", 0L) + bands.getOrDefault("At-Risk", 0L);
        long total    = bands.values().stream().mapToLong(Long::longValue).sum();
        return rate(retained, total);
    }

    /** Returns true if the given county has active programs in the given pillar. */
    private boolean isPillarInCounty(String county, String pillar) {
        return !programRepository.findByPillarAndCounty(pillar, county).isEmpty();
    }

    private ResponseEntity<String> readJson(String filename) {
        Path filePath = Paths.get(sentinelDir, WAREHOUSE, filename).toAbsolutePath();

        if (!Files.exists(filePath)) {
            log.debug("Analytics: {} not found at {} — diagnostics not yet run", filename, filePath);
            String notFound = String.format(
                "{\"error\":\"not_ready\",\"message\":\"%s not found — run python -m src.diagnostics\",\"file\":\"%s\"}",
                filename, filePath
            );
            return ResponseEntity.status(503).body(notFound);
        }

        try {
            String content = Files.readString(filePath);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json")
                    .body(content);
        } catch (IOException e) {
            log.error("Analytics: failed to read {}: {}", filePath, e.getMessage());
            String err = String.format(
                "{\"error\":\"read_error\",\"message\":\"%s\"}",
                e.getMessage().replace("\"", "'")
            );
            return ResponseEntity.internalServerError().body(err);
        }
    }

    // ── Internal record ───────────────────────────────────────────────────────

    private record TrendDeltas(BigDecimal completionRateDelta, BigDecimal retentionRateDelta) {}

    // ── Response DTOs ─────────────────────────────────────────────────────────

    public record KpiResponse(
            Long totalBeneficiaries,
            Long activeBeneficiaries,
            Integer atRiskCohorts,
            BigDecimal completionRate,
            Long totalReach,
            BigDecimal totalFunding,
            BigDecimal disbursedAmount,
            LocalDateTime updatedAt
    ) {}

    public record MetricValue(
            BigDecimal value,
            BigDecimal previousValue,
            BigDecimal changePct,
            String trendDirection
    ) {
        public static MetricValue empty() {
            return new MetricValue(BigDecimal.ZERO, null, null, null);
        }
    }

    public record PillarMetrics(
            String pillar,
            Long programCount,
            Long cohortCount,
            Long beneficiaryCount,
            BigDecimal completionRate,
            Integer atRiskCount
    ) {}

    public record CountyMetrics(
            String county,
            Long programCount,
            Long beneficiaryCount,
            BigDecimal capacityUtilization,
            BigDecimal demandForecast,
            Integer atRiskCount
    ) {}

    public record ImpactMetrics(
            Long totalBeneficiaries,
            Long activeBeneficiaries,
            Long completedBeneficiaries,
            BigDecimal completionRate,
            BigDecimal completionRateTrend,
            BigDecimal employmentRate,
            BigDecimal employmentRateTrend,
            BigDecimal retentionRate90d,
            BigDecimal retentionRateTrend,
            Integer avgTimeToCompletion,
            BigDecimal costPerBeneficiary,
            BigDecimal costPerOutcome
    ) {}

    public record PillarImpactMetrics(
            String pillar,
            Integer beneficiaries,
            BigDecimal completionRate,
            BigDecimal employmentRate,
            BigDecimal costPerBeneficiary
    ) {}

    public record ImpactTrendData(
            String month,
            Integer enrolled,
            Integer completed,
            Integer employed,
            Integer retained
    ) {}

    public record CountyReachData(
            String county,
            Integer beneficiaries,
            BigDecimal completionRate,
            BigDecimal growthRate
    ) {}

}
