package com.inukapulse.analytics;

import com.inukapulse.alert.AlertRepository;
import com.inukapulse.program.ProgramRepository;
import com.inukapulse.site.SiteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Serves pre-computed diagnostic JSON files and real-time KPI metrics.
 * 
 * Combines:
 * 1. File-based diagnostics from Python pipeline (survival, correlation, etc.)
 * 2. Real-time KPIs from dashboard_metrics table
 * 3. Computed aggregations from program/donor/site tables
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

    private final DashboardMetricsRepository metricsRepository;
    private final ProgramRepository programRepository;
    private final SiteRepository siteRepository;
    private final AlertRepository alertRepository;

    public AnalyticsService(
            DashboardMetricsRepository metricsRepository,
            ProgramRepository programRepository,
            SiteRepository siteRepository,
            AlertRepository alertRepository
    ) {
        this.metricsRepository = metricsRepository;
        this.programRepository = programRepository;
        this.siteRepository = siteRepository;
        this.alertRepository = alertRepository;
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
        // Compute KPIs directly from source tables
        long totalPrograms = programRepository.count();
        long activePrograms = programRepository.findActivePrograms().size();
        long totalCohorts = siteRepository.count();
        long activeAlerts = alertRepository.countByStatus("active");

        // These are placeholder calculations - in production would come from actual enrollment/outcome data
        long totalBeneficiaries = totalCohorts * 50; // Estimate: 50 per cohort
        long activeBeneficiaries = (long) (totalBeneficiaries * 0.85);
        int atRiskCohorts = (int) Math.min(activeAlerts, totalCohorts / 4);
        BigDecimal completionRate = new BigDecimal("76.5");

        return new KpiResponse(
                totalBeneficiaries,
                activeBeneficiaries,
                atRiskCohorts,
                completionRate,
                totalBeneficiaries,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
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

        return new PillarMetrics(
                pillar,
                programCount,
                cohortCount,
                cohortCount * 50, // Placeholder beneficiary count
                new BigDecimal("78.2"), // Placeholder completion rate
                (int) (cohortCount / 10) // Placeholder at-risk count
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
        
        return new CountyMetrics(
                county,
                programCount,
                programCount * 80, // Placeholder beneficiary count
                new BigDecimal("75.0"), // Placeholder capacity utilization
                null, // Placeholder demand forecast
                0 // Placeholder at-risk count
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

    /**
     * Model backtest report — precision, recall, F1, train/test split info.
     * Sourced from inuka_backtest_report.json (pipeline output).
     * Used by the Analyst dashboard model performance card.
     */
    public ResponseEntity<String> getBacktest() {
        return readJson(BACKTEST_FILE);
    }

    /**
     * Outcome model metrics — accuracy, precision, recall, F1, AUC-ROC,
     * feature importance from the GradientBoosting outcome predictor.
     * Sourced from outcome_model_metrics.json (pipeline output).
     */
    public ResponseEntity<String> getOutcomeMetrics() {
        return readJson(OUTCOME_METRICS_FILE);
    }

    /**
     * Outcome predictions summary — completion probability by pillar,
     * beneficiary-level predictions, summary stats.
     * Sourced from outcome_predictions.json (pipeline output).
     */
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

    // ── Internal ──────────────────────────────────────────────────────────────

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

    // ══════════════════════════════════════════════════════════════════════════
    // Impact & Reach Methods (for Leadership Dashboard)
    // ══════════════════════════════════════════════════════════════════════════

    public ImpactMetrics getImpactMetrics(String timeRange, String pillar) {
        // In production, these would be computed from actual enrollment/outcome tables
        // For now, return placeholder data that demonstrates the structure
        long baseBeneficiaries = pillar != null ? 8000 : 32000;
        long totalBeneficiaries = baseBeneficiaries;
        long activeBeneficiaries = (long) (totalBeneficiaries * 0.65);
        long completedBeneficiaries = (long) (totalBeneficiaries * 0.25);
        
        return new ImpactMetrics(
                totalBeneficiaries,
                activeBeneficiaries,
                completedBeneficiaries,
                new BigDecimal("76.8"),      // completionRate
                new BigDecimal("2.3"),       // completionRateTrend
                new BigDecimal("68.5"),      // employmentRate
                new BigDecimal("4.2"),       // employmentRateTrend
                new BigDecimal("82.4"),      // retentionRate90d
                new BigDecimal("-1.1"),      // retentionRateTrend
                14,                          // avgTimeToCompletion (weeks)
                new BigDecimal("45000"),     // costPerBeneficiary
                new BigDecimal("65000")      // costPerOutcome
        );
    }

    public List<PillarImpactMetrics> getImpactByPillar(String timeRange) {
        return List.of(
                new PillarImpactMetrics("Scholarship", 12500, new BigDecimal("82.5"), new BigDecimal("72.0"), new BigDecimal("42000")),
                new PillarImpactMetrics("Plus", 8200, new BigDecimal("78.0"), new BigDecimal("65.5"), new BigDecimal("48000")),
                new PillarImpactMetrics("Vocational", 7800, new BigDecimal("74.2"), new BigDecimal("71.8"), new BigDecimal("52000")),
                new PillarImpactMetrics("Tech", 3500, new BigDecimal("69.5"), new BigDecimal("85.2"), new BigDecimal("38000"))
        );
    }

    public List<ImpactTrendData> getImpactTrends(String timeRange, String pillar) {
        // Generate monthly trend data
        String[] months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        List<ImpactTrendData> trends = new ArrayList<>();
        
        int baseEnrolled = pillar != null ? 400 : 1600;
        Random rand = new Random(42); // Fixed seed for consistent demo data
        
        for (int i = 0; i < 12; i++) {
            int enrolled = baseEnrolled + rand.nextInt(200) - 100;
            int completed = (int) (enrolled * (0.6 + rand.nextDouble() * 0.2));
            int employed = (int) (completed * (0.5 + rand.nextDouble() * 0.3));
            int retained = (int) (enrolled * (0.7 + rand.nextDouble() * 0.2));
            
            trends.add(new ImpactTrendData(months[i], enrolled, completed, employed, retained));
        }
        
        return trends;
    }

    public List<CountyReachData> getCountyReach(String timeRange, String pillar) {
        // Sample county data for Kenya
        return List.of(
                new CountyReachData("Nairobi", 5200, new BigDecimal("78.5"), new BigDecimal("12.3")),
                new CountyReachData("Kiambu", 3800, new BigDecimal("76.2"), new BigDecimal("8.5")),
                new CountyReachData("Mombasa", 2900, new BigDecimal("74.8"), new BigDecimal("15.2")),
                new CountyReachData("Kisumu", 2400, new BigDecimal("72.1"), new BigDecimal("10.8")),
                new CountyReachData("Nakuru", 2100, new BigDecimal("75.5"), new BigDecimal("6.4")),
                new CountyReachData("Machakos", 1800, new BigDecimal("71.9"), new BigDecimal("9.2")),
                new CountyReachData("Kajiado", 1500, new BigDecimal("73.4"), new BigDecimal("18.7")),
                new CountyReachData("Uasin Gishu", 1400, new BigDecimal("77.8"), new BigDecimal("7.1")),
                new CountyReachData("Meru", 1200, new BigDecimal("70.5"), new BigDecimal("5.8")),
                new CountyReachData("Nyeri", 1100, new BigDecimal("79.2"), new BigDecimal("4.3")),
                new CountyReachData("Kilifi", 980, new BigDecimal("68.9"), new BigDecimal("22.1")),
                new CountyReachData("Kakamega", 920, new BigDecimal("71.2"), new BigDecimal("11.5")),
                new CountyReachData("Trans Nzoia", 850, new BigDecimal("72.8"), new BigDecimal("8.9")),
                new CountyReachData("Bungoma", 780, new BigDecimal("69.5"), new BigDecimal("14.2")),
                new CountyReachData("Embu", 650, new BigDecimal("74.1"), new BigDecimal("3.8"))
        );
    }

    // ── Impact DTOs ───────────────────────────────────────────────────────────

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
