package com.inukapulse.beneficiary;

import com.inukapulse.hazard.HazardReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DirectorOverviewService — aggregates data for the Programme Director's
 * deeper views:
 *
 *  1. Risk trend over time (band counts per prediction snapshot date)
 *  2. Intervention summary (follow-up stats by outcome, contact type, band)
 *  3. Welfare concern summary (open/closed hazard reports)
 *  4. Full Director overview (combines all of the above in one call)
 *
 * All methods are read-only and safe to call from Server Components.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DirectorOverviewService {

    private final BeneficiaryPredictionRepository predictionRepository;
    private final BeneficiaryFollowUpRepository    followUpRepository;
    private final HazardReportRepository           hazardRepository;

    // ── 1. Risk Trend ─────────────────────────────────────────────────────────

    /**
     * Returns risk band counts per prediction snapshot date.
     *
     * Response shape:
     * {
     *   "dates": ["2026-08-01", "2026-08-08", ...],
     *   "snapshotCount": 5,
     *   "series": [
     *     { "band": "Active",     "data": [1100, 1080, ...] },
     *     { "band": "At-Risk",    "data": [620,  640,  ...] },
     *     { "band": "Disengaged", "data": [280,  295,  ...] },
     *     { "band": "Dropout",    "data": [143,  158,  ...] }
     *   ]
     * }
     *
     * If only one snapshot exists the chart shows it clearly and
     * includes a note that trend data accumulates over daily pipeline runs.
     */
    public Map<String, Object> getRiskTrend() {
        List<Object[]> rows = predictionRepository.countByBandPerDate();
        List<LocalDate> dates = predictionRepository.findDistinctDates();

        // Build a map: date -> band -> count
        Map<LocalDate, Map<String, Long>> byDate = new LinkedHashMap<>();
        for (LocalDate d : dates) {
            Map<String, Long> bands = new LinkedHashMap<>();
            bands.put("Active", 0L);
            bands.put("At-Risk", 0L);
            bands.put("Disengaged", 0L);
            bands.put("Dropout", 0L);
            byDate.put(d, bands);
        }
        for (Object[] row : rows) {
            LocalDate date = (LocalDate) row[0];
            String band    = (String)    row[1];
            Long count     = (Long)      row[2];
            if (byDate.containsKey(date)) {
                byDate.get(date).put(band, count);
            }
        }

        // Convert to series format for Recharts LineChart
        List<String> dateStrings = dates.stream().map(LocalDate::toString).toList();
        List<Map<String, Object>> series = new ArrayList<>();
        for (String band : List.of("Active", "At-Risk", "Disengaged", "Dropout")) {
            List<Long> data = dates.stream()
                    .map(d -> byDate.getOrDefault(d, Map.of()).getOrDefault(band, 0L))
                    .toList();
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("band", band);
            s.put("data", data);
            series.add(s);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dates", dateStrings);
        result.put("snapshotCount", dates.size());
        result.put("series", series);
        result.put("hasMultipleSnapshots", dates.size() > 1);
        return result;
    }

    // ── 2. Intervention Summary ───────────────────────────────────────────────

    /**
     * Returns programme-level follow-up statistics for the Director.
     *
     * Response shape:
     * {
     *   "totalFollowUps": 148,
     *   "uniqueBeneficiariesContacted": 92,
     *   "last30Days": 43,
     *   "byOutcome": { "reached": 95, "no_answer": 32, "left_message": 15, "escalated": 6 },
     *   "byContactType": { "phone_call": 110, "home_visit": 22, "sms": 10, "email": 3, "other": 3 },
     *   "escalatedCount": 6
     * }
     */
    public Map<String, Object> getInterventionSummary() {
        List<BeneficiaryFollowUpEntity> all = followUpRepository.findAll();

        long totalFollowUps = all.size();

        long uniqueBeneficiaries = all.stream()
                .map(BeneficiaryFollowUpEntity::getBeneficiaryId)
                .distinct()
                .count();

        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        long last30Days = all.stream()
                .filter(f -> f.getCreatedAt() != null && f.getCreatedAt().isAfter(thirtyDaysAgo))
                .count();

        // Count by outcome
        Map<String, Long> byOutcome = new LinkedHashMap<>();
        byOutcome.put("reached", 0L);
        byOutcome.put("no_answer", 0L);
        byOutcome.put("left_message", 0L);
        byOutcome.put("escalated", 0L);
        for (BeneficiaryFollowUpEntity f : all) {
            String outcome = f.getOutcome() != null ? f.getOutcome() : "other";
            byOutcome.merge(outcome, 1L, Long::sum);
        }

        // Count by contact type
        Map<String, Long> byContactType = new LinkedHashMap<>();
        byContactType.put("phone_call", 0L);
        byContactType.put("home_visit", 0L);
        byContactType.put("sms", 0L);
        byContactType.put("email", 0L);
        byContactType.put("other", 0L);
        for (BeneficiaryFollowUpEntity f : all) {
            String ct = f.getContactType() != null ? f.getContactType() : "other";
            byContactType.merge(ct, 1L, Long::sum);
        }

        long escalatedCount = byOutcome.getOrDefault("escalated", 0L);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalFollowUps",              totalFollowUps);
        result.put("uniqueBeneficiariesContacted", uniqueBeneficiaries);
        result.put("last30Days",                  last30Days);
        result.put("byOutcome",                   byOutcome);
        result.put("byContactType",               byContactType);
        result.put("escalatedCount",              escalatedCount);
        return result;
    }

    // ── 3. Welfare Concern Summary ────────────────────────────────────────────

    /**
     * Returns open/closed welfare concern counts from hazard_report.
     * Uses report_type = 'welfare_concern' where available; falls back to
     * all hazard reports to avoid empty panels on systems that haven't
     * yet started using the welfare_concern report_type.
     *
     * Response shape:
     * {
     *   "totalOpen": 12,
     *   "totalClosed": 8,
     *   "total": 20,
     *   "openRate": "60%"
     * }
     */
    public Map<String, Object> getWelfareSummary() {
        long openCount   = hazardRepository.findByStatusOrderByCreatedAtDesc("open").size();
        long closedCount = hazardRepository.findByStatusOrderByCreatedAtDesc("closed").size();
        long total       = openCount + closedCount;
        String openRate  = total > 0
                ? Math.round((openCount * 100.0) / total) + "%"
                : "0%";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalOpen",   openCount);
        result.put("totalClosed", closedCount);
        result.put("total",       total);
        result.put("openRate",    openRate);
        return result;
    }

    // ── 4. Full Director Overview (single endpoint) ───────────────────────────

    /**
     * Combines prediction summary, risk trend, intervention summary, and
     * welfare summary into a single response — reduces round trips for the
     * Director dashboard deeper-views section.
     */
    public Map<String, Object> getDirectorOverview() {
        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("riskTrend",          getRiskTrend());
        overview.put("interventions",       getInterventionSummary());
        overview.put("welfareConcerns",     getWelfareSummary());
        return overview;
    }
}
