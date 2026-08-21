package com.inukapulse.etl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inukapulse.alert.AlertRulesEngine;
import com.inukapulse.prediction.PredictionEntity;
import com.inukapulse.prediction.PredictionRepository;
import com.inukapulse.site.AuditEntity;
import com.inukapulse.site.AuditRepository;
import com.inukapulse.site.IncidentEntity;
import com.inukapulse.site.IncidentRepository;
import com.inukapulse.site.SiteRepository;
import com.inukapulse.ingestion.IngestLogEntity;
import com.inukapulse.ingestion.IngestLogRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;


@Service
@RequiredArgsConstructor
@Slf4j
public class EtlReloadService {

    private final IncidentRepository             incidentRepository;
    private final AuditRepository                auditRepository;
    private final SiteRepository                 siteRepository;
    private final PredictionRepository           predictionRepository;
    private final IngestLogRepository            ingestLogRepository;
    private final ObjectMapper                   objectMapper;
    private final AlertRulesEngine               alertRulesEngine;

    @Value("${inuka.etl.live-batch-path:../inuka-pipeline/data/warehouse/live_batch.json}")
    private String liveBatchPath;

    @Value("${inuka.etl.pipeline-dir:../inuka-pipeline}")
    private String sentinelDir;  // kept as sentinelDir internally to avoid large refactor; points to inuka-pipeline root

    @Value("${inuka.etl.enabled:true}")
    private boolean enabled;

    @Value("${inuka.etl.rows-per-cycle:200}")
    private int rowsPerCycle;

    @Value("${inuka.etl.poll-interval-ms:120000}")
    private long pollIntervalMs;

    @Value("${inuka.etl.frontend-refresh-ms:125000}")
    private long frontendRefreshMs;

    private String  lastProcessedBatchId = null;
    private Process etlProcess           = null;

    // ── Config accessors (used by EtlConfigController) ───────────────────────

    public long getFrontendRefreshMs() { return frontendRefreshMs; }
    public long getPollIntervalMs()    { return pollIntervalMs; }
    public int  getRowsPerCycle()      { return rowsPerCycle; }

    // ── Auto-start on boot ────────────────────────────────────────────────────

    /**
     * Called automatically by Spring after the bean is wired up.
     * Launches run_live.sh in the background — no manual cd or script needed.
     */
    @PostConstruct
    public void startEtlLoop() {
        if (!enabled) {
            log.info("ETL auto-start disabled (inuka.etl.enabled=false)");
            return;
        }

        File dir    = new File(sentinelDir).getAbsoluteFile();
        File script = new File(dir, "run_live.sh");

        if (!dir.isDirectory()) {
            log.warn("ETL auto-start: inuka-pipeline dir not found at '{}' — run run_live.sh manually.",
                    dir.getAbsolutePath());
            return;
        }
        if (!script.exists()) {
            log.warn("ETL auto-start: run_live.sh not found at '{}' — run manually.",
                    script.getAbsolutePath());
            return;
        }

        try {
            script.setExecutable(true);

            File logFile = new File(dir, "logs/etl.log");
            logFile.getParentFile().mkdirs();

            ProcessBuilder pb = new ProcessBuilder("/bin/bash", script.getAbsolutePath());
            pb.directory(dir);
            pb.environment().put("ROWS",     String.valueOf(rowsPerCycle));
            pb.environment().put("INTERVAL", String.valueOf(pollIntervalMs / 1000));
            pb.redirectOutput(ProcessBuilder.Redirect.appendTo(logFile));
            pb.redirectError(ProcessBuilder.Redirect.appendTo(logFile));

            etlProcess = pb.start();
            log.info("ETL auto-start: run_live.sh started (pid={}, rows={}, log={})",
                    etlProcess.pid(), rowsPerCycle, logFile.getAbsolutePath());

        } catch (IOException e) {
            log.error("ETL auto-start failed: {} — run manually: cd {} && ./run_live.sh",
                    e.getMessage(), dir.getAbsolutePath());
        }
    }

    /** Stops the background ETL process when Spring Boot shuts down. */
    @PreDestroy
    public void stopEtlLoop() {
        if (etlProcess != null && etlProcess.isAlive()) {
            log.info("ETL shutdown: stopping run_live.sh (pid={})", etlProcess.pid());
            etlProcess.destroy();
        }
    }

    // ── Scheduled reload ──────────────────────────────────────────────────────

    @Scheduled(fixedDelayString = "${inuka.etl.poll-interval-ms:60000}", initialDelay = 5000)
    public void reload() {
        if (!enabled) return;

        File batchFile = new File(liveBatchPath);
        if (!batchFile.exists()) {
            log.debug("ETL reload: live_batch.json not found at {} — skipping", liveBatchPath);
            return;
        }

        try {
            LiveBatchRecord batch = objectMapper.readValue(batchFile, LiveBatchRecord.class);

            if (batch.getBatchId() != null && batch.getBatchId().equals(lastProcessedBatchId)) {
                log.debug("ETL reload: batch {} already processed — skipping", batch.getBatchId());
                return;
            }

            // Load the 6-site ID set once — shared across all three loaders this cycle.
            // Avoids siteRepository.existsById() firing per record inside each loop.
            Set<String> knownSiteIds = siteRepository.findAll().stream()
                    .map(s -> s.getSiteId().toLowerCase())
                    .collect(java.util.stream.Collectors.toSet());

            // Each loader runs in its own transaction so a failure in one
            // does not roll back the others.
            List<IncidentEntity> savedIncidents = loadIncidents(batch.getIncidents(), batch.getBatchId(), knownSiteIds);
            List<AuditEntity>    savedAudits    = loadAudits(batch.getAudits(), batch.getBatchId(), knownSiteIds);
            int predsLoaded = loadPredictions();

            lastProcessedBatchId = batch.getBatchId();

            // ── Persist quality log entry for this batch ──────────────────────
            Map<?,?> summary = batch.getSummary();
            int bTrusted  = summary != null && summary.get("trusted")  instanceof Number n1 ? n1.intValue() : 0;
            int bReview   = summary != null && summary.get("review")   instanceof Number n2 ? n2.intValue() : 0;
            int bRejected = summary != null && summary.get("rejected") instanceof Number n3 ? n3.intValue() : 0;
            int bTotal    = bTrusted + bReview + bRejected + savedIncidents.size() + savedAudits.size();

            if (batch.getBatchId() != null && !ingestLogRepository.existsByBatchId(batch.getBatchId())) {
                IngestLogEntity logEntry = new IngestLogEntity();
                logEntry.setBatchId(batch.getBatchId());
                logEntry.setSourceFilename("live_batch.json");
                logEntry.setRowCount(bTotal);
                logEntry.setSha256Checksum(String.valueOf(batch.getBatchId().hashCode()));
                logEntry.setIngestionTimestamp(LocalDateTime.now());
                logEntry.setTrustedCount(bTrusted > 0 ? bTrusted : savedIncidents.size() + savedAudits.size());
                logEntry.setCorrectedCount(0);
                logEntry.setReviewCount(bReview);
                logEntry.setRejectedCount(bRejected);
                ingestLogRepository.save(logEntry);
            }

            log.info("ETL reload [{}]: +{} incidents, +{} audits, {} predictions | summary={}",
                    shortId(batch.getBatchId()), savedIncidents.size(), savedAudits.size(),
                    predsLoaded, batch.getSummary());

            // Evaluate alert rules against the newly loaded incidents.
            // Runs outside the loader transactions — alert failures never affect data load.
            try {
                alertRulesEngine.evaluate(savedIncidents, buildAttemptedIncidents(batch.getIncidents(), knownSiteIds));
                alertRulesEngine.refreshStaleNarratives();
            } catch (Exception alertEx) {
                log.warn("AlertRulesEngine evaluation failed (non-fatal): {}", alertEx.getMessage());
            }

        } catch (Exception e) {
            log.error("ETL reload failed: {}", e.getMessage(), e);
        }
    }

    // ── Incidents ─────────────────────────────────────────────────────────────

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public List<IncidentEntity> loadIncidents(List<Map<String, Object>> records, String batchId, Set<String> knownSiteIds) {
        if (records == null || records.isEmpty()) return List.of();

        // One IN-query to find all already-persisted IDs for this batch — replaces N existsById calls.
        Set<String> candidateIds = records.stream()
                .map(r -> str(r, "incident_id"))
                .filter(id -> id != null && !id.isBlank())
                .collect(java.util.stream.Collectors.toSet());
        Set<String> existingIds = incidentRepository.findExistingIds(candidateIds);

        List<IncidentEntity> toSave = new java.util.ArrayList<>();
        for (Map<String, Object> r : records) {
            String id = str(r, "incident_id");
            if (id == null || id.isBlank()) continue;
            if (existingIds.contains(id)) continue;

            String siteId = normaliseSiteId(str(r, "site"));
            if (siteId == null || !knownSiteIds.contains(siteId)) {
                log.debug("ETL: skipping incident {} — unknown site '{}'", id, str(r, "site"));
                continue;
            }

            IncidentEntity e = new IncidentEntity();
            e.setIncidentId(id);
            e.setSiteId(siteId);
            e.setIncidentDate(parseDateTime(str(r, "incident_date")));
            e.setSeverity(str(r, "severity"));
            e.setDescription(str(r, "description"));
            e.setComplianceScore(toInt(r.get("compliance_score")));
            e.setStatus(str(r, "status"));
            e.setDecision(str(r, "decision"));
            e.setDecisionReason(str(r, "decision_reason"));
            e.setBatchId(batchId);
            e.setIngestionTimestamp(LocalDateTime.now());
            toSave.add(e);
        }

        incidentRepository.saveAll(toSave);
        return toSave;
    }

    // ── Audits ────────────────────────────────────────────────────────────────

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public List<AuditEntity> loadAudits(List<Map<String, Object>> records, String batchId, Set<String> knownSiteIds) {
        if (records == null || records.isEmpty()) return List.of();

        Set<String> candidateIds = records.stream()
                .map(r -> str(r, "audit_id"))
                .filter(id -> id != null && !id.isBlank())
                .collect(java.util.stream.Collectors.toSet());
        Set<String> existingIds = auditRepository.findExistingIds(candidateIds);

        List<AuditEntity> toSave = new java.util.ArrayList<>();
        for (Map<String, Object> r : records) {
            String id = str(r, "audit_id");
            if (id == null || id.isBlank()) continue;
            if (existingIds.contains(id)) continue;

            String siteId = normaliseSiteId(str(r, "site"));
            if (siteId == null || !knownSiteIds.contains(siteId)) {
                log.debug("ETL: skipping audit {} — unknown site '{}'", id, str(r, "site"));
                continue;
            }

            AuditEntity e = new AuditEntity();
            e.setAuditId(id);
            e.setSiteId(siteId);
            e.setInspectionDate(parseDateTime(str(r, "inspection_date")));
            e.setClosedDate(parseDateTime(str(r, "closed_date")));
            e.setAuditor(str(r, "auditor"));
            e.setFindings(str(r, "findings_detail"));
            e.setComplianceScore(toInt(r.get("compliance_score")));
            e.setFollowUpRequired(Boolean.TRUE.equals(r.get("follow_up_required")));
            e.setDecision(str(r, "decision"));
            e.setDecisionReason(str(r, "decision_reason"));
            e.setBatchId(batchId);
            e.setIngestionTimestamp(LocalDateTime.now());
            toSave.add(e);
        }

        auditRepository.saveAll(toSave);
        return toSave;
    }

    // ── Environmental readings (not used for Inuka — corridor package removed) ─

    // loadEnvironmental() has been removed. Inuka Pulse does not use pipeline
    // corridor telemetry readings. The field in LiveBatchRecord is kept for
    // structural compatibility but the records are silently ignored.

    // ── Predictions (ML model scores) ────────────────────────────────────────

    /**
     * Reads the inuka_predictions_export.json from the inuka-pipeline warehouse
     * and upserts records into fact_predictions DB table.
     *
     * Uses ON CONFLICT DO NOTHING semantics via the unique constraint on
     * (site_id, as_of_date). Only new date snapshots are added; existing rows
     * are not overwritten (model artifacts are immutable per date).
     *
     * Returns the number of new rows inserted.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public int loadPredictions() {
        // Resolve the JSON export path from the configured pipeline dir
        File jsonFile = new File(sentinelDir, "data/warehouse/inuka_predictions_export.json");
        if (!jsonFile.exists()) {
            log.debug("ETL: inuka_predictions_export.json not found at {} — model not trained yet", jsonFile.getAbsolutePath());
            return 0;
        }

        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> records = objectMapper.readValue(jsonFile, List.class);
            if (records == null || records.isEmpty()) return 0;

            int loaded = 0;
            for (Map<String, Object> r : records) {
                String siteId = normaliseSiteId(str(r, "site_id"));
                if (siteId == null || siteId.isBlank()) continue;

                String dateStr = str(r, "as_of_date");
                LocalDate asOfDate = dateStr != null ? LocalDate.parse(dateStr) : null;
                if (asOfDate == null) continue;

                Object probObj = r.get("incident_probability_7d");
                if (probObj == null) continue;
                double prob;
                try {
                    prob = Double.parseDouble(probObj.toString());
                } catch (NumberFormatException ex) {
                    continue;
                }

                // Skip if this (site, date) already exists
                boolean exists = predictionRepository.findLatestBySiteId(siteId)
                        .map(p -> p.getAsOfDate().equals(asOfDate))
                        .orElse(false);
                if (exists) continue;

                PredictionEntity e = new PredictionEntity();
                e.setSiteId(siteId);
                e.setAsOfDate(asOfDate);
                e.setProbability(prob);
                e.setModelVersion(str(r, "model_version"));
                e.setTopFeatures(str(r, "top_features"));
                predictionRepository.save(e);
                loaded++;
            }
            return loaded;
        } catch (Exception ex) {
            log.warn("ETL: prediction load failed (non-fatal): {}", ex.getMessage());
            return 0;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Builds a lightweight list of IncidentEntity objects from raw JSON records
     * for ALL candidates in this batch (including duplicates that were skipped).
     * Used by AlertRulesEngine to compute rejection rates across the full batch.
     */
    private List<IncidentEntity> buildAttemptedIncidents(List<Map<String, Object>> records,
                                                          Set<String> knownSiteIds) {
        if (records == null) return List.of();
        List<IncidentEntity> result = new java.util.ArrayList<>();
        for (Map<String, Object> r : records) {
            String id     = str(r, "incident_id");
            String siteRaw = str(r, "site");
            if (id == null || id.isBlank()) continue;
            String siteId = normaliseSiteId(siteRaw);
            if (siteId == null || !knownSiteIds.contains(siteId)) continue;

            IncidentEntity e = new IncidentEntity();
            e.setIncidentId(id);
            e.setSiteId(siteId);
            e.setSeverity(str(r, "severity"));
            e.setDecision(str(r, "decision"));
            e.setIncidentDate(parseDateTime(str(r, "incident_date")));
            result.add(e);
        }
        return result;
    }

    /** "SITE-001" → "site-001" — matches the lowercase keys in V2__seed_data.sql */
    private String normaliseSiteId(String raw) {
        if (raw == null) return null;
        return raw.toLowerCase();
    }

    private static final DateTimeFormatter[] DATE_FORMATS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
    };

    private LocalDateTime parseDateTime(String raw) {
        if (raw == null || raw.isBlank()) return null;
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                if (raw.length() == 10) {   // date-only → midnight
                    return LocalDateTime.parse(raw + "T00:00:00",
                            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"));
                }
                return LocalDateTime.parse(raw, fmt);
            } catch (DateTimeParseException ignored) { }
        }
        log.debug("ETL: could not parse date '{}' — storing null", raw);
        return null;
    }

    private String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v == null ? null : v.toString().trim();
    }

    private Integer toInt(Object v) {
        if (v == null) return null;
        try { return (int) Double.parseDouble(v.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    private Double toDouble(Object v) {
        if (v == null) return null;
        try { return Double.parseDouble(v.toString()); }
        catch (NumberFormatException e) { return null; }
    }

    private String shortId(String id) {
        return id == null ? "null" : id.substring(0, Math.min(8, id.length()));
    }
}
