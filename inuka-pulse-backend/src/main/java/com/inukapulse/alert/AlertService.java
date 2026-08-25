package com.inukapulse.alert;

import com.inukapulse.common.dto.AlertDto;
import com.inukapulse.site.SiteEntity;
import com.inukapulse.site.SiteRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Alert service — generates, persists, and queries alerts.
 * Each alert links back to the specific record(s) and rule that produced it,
 * carrying forward Stage 1's "traceable reason" principle.
 *
 * Performance notes:
 * - siteNameCache: The dim_site table is a small lookup table. Loading it once
 *   on startup eliminates a redundant DB round-trip on every GET /api/alerts call.
 *   The cache is a ConcurrentHashMap so it is safe for concurrent reads.
 *   The cache is refreshed every 5 minutes to pick up any site name changes.
 */
@Service
@Slf4j
public class AlertService {

    private static final DateTimeFormatter ISO_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");

    private final AlertRepository alertRepository;
    private final SiteRepository  siteRepository;

    // Cached site names — refreshed every 5 minutes
    private final Map<String, String> siteNameCache = new ConcurrentHashMap<>();

    public AlertService(AlertRepository alertRepository, SiteRepository siteRepository) {
        this.alertRepository = alertRepository;
        this.siteRepository  = siteRepository;
    }

    /**
     * Populate the site name cache on startup.
     * Runs after dependency injection is complete — before any request arrives.
     */
    @PostConstruct
    public void loadSiteCache() {
        refreshSiteCache();
    }

    /**
     * Refresh the site name cache periodically.
     * Runs every 5 minutes to pick up any site name changes without requiring restart.
     * 
     * This ensures that if a site is renamed in the database, alerts will reflect
     * the new name within 5 minutes without any service interruption.
     */
    @Scheduled(fixedRate = 300_000, initialDelay = 300_000) // 5 minutes
    public void refreshSiteCache() {
        try {
            Map<String, String> newCache = new HashMap<>();
            siteRepository.findAll().forEach(s ->
                    newCache.put(s.getSiteId(), s.getSiteName())
            );
            
            // Only log if there were actual changes
            if (!newCache.equals(new HashMap<>(siteNameCache))) {
                log.debug("Site cache refreshed: {} sites", newCache.size());
            }
            
            // Atomic update: clear and repopulate
            siteNameCache.clear();
            siteNameCache.putAll(newCache);
        } catch (Exception e) {
            log.warn("Failed to refresh site cache: {} — using stale cache", e.getMessage());
            // Keep existing cache on failure — stale data is better than no data
        }
    }

    public List<AlertDto> getAllAlerts() {
        // Uses the in-memory cache — no extra DB round-trip per request.
        return alertRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public void acknowledgeAlert(String alertId) {
        AlertEntity alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NoSuchElementException("Alert not found: " + alertId));

        // Read the authenticated user's email from the JWT (set by JwtAuthFilter).
        // Falls back to "system" if somehow called without an authenticated context.
        String acknowledgedBy = Optional.ofNullable(
                SecurityContextHolder.getContext().getAuthentication()
        ).map(auth -> auth.getName()).orElse("system");

        LocalDateTime acknowledgedAt = LocalDateTime.now();
        
        alert.setStatus("acknowledged");
        alert.setAcknowledgedAt(acknowledgedAt);
        alert.setAcknowledgedBy(acknowledgedBy);
        alertRepository.save(alert);
        
        // Audit log: Alert acknowledgment is a significant action that should be traceable.
        // This log enables accountability for who responded to which at-risk beneficiary alerts.
        log.info("AUDIT: Alert acknowledged | alertId={} | severity={} | siteId={} | " +
                 "acknowledgedBy={} | acknowledgedAt={} | title={}",
                alertId,
                alert.getSeverity(),
                alert.getSiteId(),
                acknowledgedBy,
                acknowledgedAt.format(ISO_FORMATTER),
                alert.getTitle()
        );
    }

    private AlertDto toDto(AlertEntity entity) {
        List<String> recordIds = entity.getRecordIds() != null && !entity.getRecordIds().isBlank()
                ? Arrays.asList(entity.getRecordIds().split(","))
                : List.of();

        return AlertDto.builder()
                .id(entity.getId())
                .siteId(entity.getSiteId())
                .siteName(siteNameCache.getOrDefault(entity.getSiteId(), "Unknown"))
                .severity(entity.getSeverity())
                .status(entity.getStatus())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .rule(entity.getRule())
                .recordIds(recordIds)
                .createdAt(formatTimestamp(entity.getCreatedAt()))
                .acknowledgedAt(entity.getAcknowledgedAt() != null
                        ? formatTimestamp(entity.getAcknowledgedAt()) : null)
                .acknowledgedBy(entity.getAcknowledgedBy())
                .narrative(entity.getNarrative())
                .narrativeUpdatedAt(entity.getNarrativeUpdatedAt() != null
                        ? formatTimestamp(entity.getNarrativeUpdatedAt()) : null)
                .build();
    }

    private String formatTimestamp(LocalDateTime dt) {
        return dt != null ? dt.format(ISO_FORMATTER) : null;
    }
}
