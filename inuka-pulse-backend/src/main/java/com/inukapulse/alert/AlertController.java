package com.inukapulse.alert;

import com.inukapulse.common.dto.AlertDto;
import com.inukapulse.site.IncidentEntity;
import com.inukapulse.site.IncidentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * REST API for the alert feed.
 * Each alert links back to the specific record(s) and rule that produced it,
 * carrying forward Stage 1's "traceable reason" principle.
 */
@RestController
@RequestMapping("/api/alerts")
@Slf4j
public class AlertController {

    private final AlertService alertService;
    private final AlertRulesEngine alertRulesEngine;
    private final IncidentRepository incidentRepository;

    @Value("${inuka.etl.api-key:}")
    private String etlApiKey;

    public AlertController(AlertService alertService, 
                          AlertRulesEngine alertRulesEngine,
                          IncidentRepository incidentRepository) {
        this.alertService = alertService;
        this.alertRulesEngine = alertRulesEngine;
        this.incidentRepository = incidentRepository;
    }

    /** GET /api/alerts — paginated, filterable alert feed */
    @GetMapping
    public ResponseEntity<List<AlertDto>> getAlerts() {
        return ResponseEntity.ok(alertService.getAllAlerts());
    }

    /** POST /api/alerts/{id}/ack — acknowledge an alert (audit-logged) */
    @PostMapping("/{id}/ack")
    public ResponseEntity<Void> acknowledgeAlert(@PathVariable String id) {
        alertService.acknowledgeAlert(id);
        return ResponseEntity.ok().build();
    }

    /**
     * POST /api/alerts/evaluate — trigger alert rules evaluation on recent data.
     * 
     * Called by the ETL pipeline after direct database writes to ensure alerts
     * are generated for newly inserted incidents. Evaluates incidents ingested
     * in the last 15 minutes by default.
     * 
     * Authentication: requires X-ETL-Api-Key header matching the configured key.
     * If no ETL API key is configured, the endpoint is open (for development).
     * 
     * Request body (optional):
     *   { "minutesBack": 30 }  — override the lookback window
     * 
     * Response:
     *   { "incidentsEvaluated": 45, "status": "completed" }
     */
    @PostMapping("/evaluate")
    public ResponseEntity<Map<String, Object>> evaluateAlerts(
            @RequestHeader(value = "X-ETL-Api-Key", required = false) String apiKey,
            @RequestBody(required = false) Map<String, Integer> request) {
        
        // Validate API key if configured
        if (etlApiKey != null && !etlApiKey.isBlank()) {
            if (apiKey == null || !apiKey.equals(etlApiKey)) {
                log.warn("AlertController: evaluate called with invalid API key");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing X-ETL-Api-Key"));
            }
        }

        int minutesBack = 15; // default lookback
        if (request != null && request.containsKey("minutesBack")) {
            minutesBack = Math.min(request.get("minutesBack"), 60); // cap at 60 min
        }

        LocalDateTime since = LocalDateTime.now().minusMinutes(minutesBack);
        
        log.info("AlertController: evaluating alerts for incidents since {} ({} min ago)",
                since, minutesBack);

        // Find recently ingested incidents
        List<IncidentEntity> recentIncidents = incidentRepository.findByIngestionTimestampAfter(since);
        
        if (recentIncidents.isEmpty()) {
            log.info("AlertController: no recent incidents found — skipping evaluation");
            return ResponseEntity.ok(Map.of(
                "incidentsEvaluated", 0,
                "status", "no_data"
            ));
        }

        // Run alert rules engine
        alertRulesEngine.evaluate(recentIncidents, recentIncidents);
        
        // Also refresh stale narratives
        alertRulesEngine.refreshStaleNarratives();

        log.info("AlertController: evaluated {} incidents for alert rules", recentIncidents.size());

        return ResponseEntity.ok(Map.of(
            "incidentsEvaluated", recentIncidents.size(),
            "status", "completed"
        ));
    }
}
