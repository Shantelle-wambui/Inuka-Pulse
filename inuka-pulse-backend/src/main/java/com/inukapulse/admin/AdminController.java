package com.inukapulse.admin;

import com.inukapulse.analytics.DashboardMetricsRefreshJob;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Admin endpoints for system maintenance operations.
 */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final DashboardMetricsRefreshJob metricsRefreshJob;

    public AdminController(DashboardMetricsRefreshJob metricsRefreshJob) {
        this.metricsRefreshJob = metricsRefreshJob;
    }

    /**
     * Manually trigger dashboard metrics refresh.
     * 
     * POST /api/v1/admin/refresh-metrics
     */
    @PostMapping("/refresh-metrics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> refreshMetrics() {
        long startTime = System.currentTimeMillis();
        
        int metricsCount = metricsRefreshJob.triggerRefresh();
        
        long duration = System.currentTimeMillis() - startTime;
        
        return ResponseEntity.ok(Map.of(
                "success", true,
                "metricsUpdated", metricsCount,
                "durationMs", duration,
                "refreshedAt", LocalDateTime.now().toString()
        ));
    }

    /**
     * Health check for admin operations.
     * 
     * GET /api/v1/admin/health
     */
    @GetMapping("/health")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "timestamp", LocalDateTime.now().toString(),
                "scheduledJobsEnabled", true
        ));
    }
}
