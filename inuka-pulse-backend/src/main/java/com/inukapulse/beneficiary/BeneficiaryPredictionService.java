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
     */
    public Map<String, Map<String, Long>> getBreakdownByCounty() {
        List<String> counties = repository.findDistinctCounties();
        Map<String, Map<String, Long>> result = new LinkedHashMap<>();
        for (String county : counties) {
            List<Object[]> rows = repository.countByBandForCounty(county);
            result.put(county, toBandMap(rows));
        }
        return result;
    }

    /**
     * Band breakdown by pillar — used by Director pillar comparison chart.
     */
    public Map<String, Map<String, Long>> getBreakdownByPillar() {
        List<String> pillars = repository.findDistinctPillars();
        Map<String, Map<String, Long>> result = new LinkedHashMap<>();
        for (String pillar : pillars) {
            List<Object[]> rows = repository.countByBandForPillar(pillar);
            result.put(pillar, toBandMap(rows));
        }
        return result;
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
