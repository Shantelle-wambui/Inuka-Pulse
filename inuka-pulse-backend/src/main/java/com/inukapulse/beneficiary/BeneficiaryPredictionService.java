package com.inukapulse.beneficiary;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BeneficiaryPredictionService {

    private final BeneficiaryPredictionRepository repository;

    // ── Summary (KPI cards, band counts) ─────────────────────────────────────

    /**
     * Returns a summary map used by the Programme Director KPI strip.
     * Example output:
     * {
     *   "total": 2173,
     *   "active": 1100,
     *   "atRisk": 650,
     *   "disengaged": 280,
     *   "dropout": 143,
     *   "lastUpdated": "2026-08-24",
     *   "counties": ["Nairobi", "Mombasa", ...],
     *   "pillars": ["Scholarship", "Plus", ...]
     * }
     */
    public Map<String, Object> getSummary() {
        List<Object[]> bandCounts = repository.countByBand();

        long active     = 0, atRisk = 0, disengaged = 0, dropout = 0;
        for (Object[] row : bandCounts) {
            String band  = (String) row[0];
            long   count = (Long)   row[1];
            switch (band) {
                case "Active"     -> active     = count;
                case "At-Risk"    -> atRisk     = count;
                case "Disengaged" -> disengaged = count;
                case "Dropout"    -> dropout    = count;
            }
        }
        long total = active + atRisk + disengaged + dropout;

        Optional<LocalDate> latestDate = repository.findLatestAsOfDate();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total",       total);
        summary.put("active",      active);
        summary.put("atRisk",      atRisk);
        summary.put("disengaged",  disengaged);
        summary.put("dropout",     dropout);
        summary.put("lastUpdated", latestDate.map(LocalDate::toString).orElse(null));
        summary.put("counties",    repository.findDistinctCounties());
        summary.put("pillars",     repository.findDistinctPillars());
        return summary;
    }

    /**
     * Band breakdown by county — used by Director county comparison chart.
     * Returns { "Nairobi": {"Active":300, "At-Risk":120, ...}, "Mombasa": {...} }
     * 
     * PERFORMANCE: Uses a single aggregate query instead of N queries (one per county).
     * With 47 counties in Kenya, this reduces database round-trips from 48 to 1.
     */
    public Map<String, Map<String, Long>> getBreakdownByCounty() {
        // Single query returns [county, band, count] rows for all counties
        List<Object[]> aggregateRows = repository.countByBandGroupedByCounty();
        return aggregateToNestedMap(aggregateRows);
    }

    /**
     * Band breakdown by pillar — used by Director pillar comparison chart.
     * 
     * PERFORMANCE: Uses a single aggregate query instead of N queries (one per pillar).
     */
    public Map<String, Map<String, Long>> getBreakdownByPillar() {
        // Single query returns [pillar, band, count] rows for all pillars
        List<Object[]> aggregateRows = repository.countByBandGroupedByPillar();
        return aggregateToNestedMap(aggregateRows);
    }

    // ── Beneficiary lists ─────────────────────────────────────────────────────

    /**
     * Paginated list of latest predictions — used by Analyst and Director.
     * All filters are optional (pass null to skip).
     */
    public Page<BeneficiaryPredictionDto> getList(
            String band, String county, String pillar, String cohort,
            int page, int size) {

        Pageable pageable = PageRequest.of(page, Math.min(size, 200));
        return repository
                .findLatestFiltered(band, county, pillar, cohort, pageable)
                .map(BeneficiaryPredictionDto::from);
    }

    /**
     * Beneficiaries for a specific cohort — used by Case Manager caseload.
     * Returns high-risk first (sorted by dropoutProb DESC in query).
     */
    public List<BeneficiaryPredictionDto> getByCohort(String cohortId) {
        return repository.findLatestByCohort(cohortId)
                .stream()
                .map(BeneficiaryPredictionDto::from)
                .collect(Collectors.toList());
    }

    /**
     * Single beneficiary detail — used by beneficiary detail page.
     */
    public Optional<BeneficiaryPredictionDto> getByBeneficiaryId(String beneficiaryId) {
        return repository.findLatestByBeneficiaryId(beneficiaryId)
                .map(BeneficiaryPredictionDto::from);
    }

    /**
     * Top N highest-risk beneficiaries — used by Director "most at-risk" panel.
     */
    public List<BeneficiaryPredictionDto> getTopAtRisk(int n) {
        return repository
                .findLatestFiltered("At-Risk", null, null, null, PageRequest.of(0, n))
                .stream()
                .map(BeneficiaryPredictionDto::from)
                .collect(Collectors.toList());
    }

    /**
     * Top N predicted dropouts — used by Director "dropout" panel.
     */
    public List<BeneficiaryPredictionDto> getTopDropout(int n) {
        return repository
                .findLatestFiltered("Dropout", null, null, null, PageRequest.of(0, n))
                .stream()
                .map(BeneficiaryPredictionDto::from)
                .collect(Collectors.toList());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Converts aggregate query results [groupKey, band, count] into nested map.
     * 
     * @param rows Query results where row[0] = groupKey (county/pillar), 
     *             row[1] = band, row[2] = count
     * @return Map of { groupKey: { band: count, ... }, ... }
     */
    private Map<String, Map<String, Long>> aggregateToNestedMap(List<Object[]> rows) {
        Map<String, Map<String, Long>> result = new LinkedHashMap<>();
        
        for (Object[] row : rows) {
            String groupKey = (String) row[0];
            String band     = (String) row[1];
            Long   count    = (Long)   row[2];
            
            // Initialize band map for this group if not present
            result.computeIfAbsent(groupKey, k -> {
                Map<String, Long> bandMap = new LinkedHashMap<>();
                bandMap.put("Active", 0L);
                bandMap.put("At-Risk", 0L);
                bandMap.put("Disengaged", 0L);
                bandMap.put("Dropout", 0L);
                return bandMap;
            });
            
            result.get(groupKey).put(band, count);
        }
        
        return result;
    }

    private Map<String, Long> toBandMap(List<Object[]> rows) {
        Map<String, Long> map = new LinkedHashMap<>();
        map.put("Active", 0L);
        map.put("At-Risk", 0L);
        map.put("Disengaged", 0L);
        map.put("Dropout", 0L);
        for (Object[] row : rows) {
            map.put((String) row[0], (Long) row[1]);
        }
        return map;
    }
}
