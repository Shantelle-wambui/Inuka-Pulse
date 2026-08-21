package com.inukapulse.analytics;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Serves pre-computed diagnostic JSON files produced by src/diagnostics.py.
 *
 * No DB tables are needed for diagnostics — they are computed artifacts, not
 * relational facts. The service reads the files on each request and returns
 * the raw JSON string; Spring serialises it directly to the response body.
 *
 * If a file doesn't exist yet (diagnostics not yet run), returns a structured
 * error payload so the frontend can show a loading state rather than crashing.
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
    private static final String ROI_REFERENCE_FILE    = "inuka_roi_reference.json";
    private static final String ROI_SIMULATION_FILE   = "roi_simulation_result.json";
    private static final String ROI_REFERENCE_DIR     = "data/reference";

    // ── Public API ────────────────────────────────────────────────────────────

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

    public ResponseEntity<String> getRoiReferenceCase() {
        // Read from data/reference/ not data/warehouse/
        Path filePath = Paths.get(sentinelDir, ROI_REFERENCE_DIR, ROI_REFERENCE_FILE).toAbsolutePath();
        if (!Files.exists(filePath)) {
            // Return Inuka-specific default assumptions if reference file hasn't been generated yet
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
}
