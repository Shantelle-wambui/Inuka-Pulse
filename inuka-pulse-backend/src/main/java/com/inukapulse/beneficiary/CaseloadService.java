package com.inukapulse.beneficiary;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * CaseloadService — scoped view of beneficiary predictions for a Case Manager.
 *
 * A Case Manager sees only the beneficiaries in the cohorts assigned to them
 * via the officer_cohort_assignment table. This is the field-level security
 * layer on top of the authenticated API.
 *
 * All methods require a userId (from the JWT) and return data only for
 * that officer's assigned cohorts.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CaseloadService {

    private final OfficerCohortAssignmentRepository assignmentRepository;
    private final BeneficiaryPredictionRepository   predictionRepository;

    /**
     * Returns all beneficiaries in the officer's assigned cohorts,
     * sorted high-risk first (dropout_prob DESC).
     *
     * Used by: GET /api/beneficiaries/predictions/my-caseload
     */
    public List<BeneficiaryPredictionDto> getMyCaseload(Long userId) {
        List<String> cohortIds = assignmentRepository.findCohortIdsByUserId(userId);
        if (cohortIds.isEmpty()) {
            log.debug("CaseloadService: user {} has no cohort assignments", userId);
            return List.of();
        }

        // Fetch latest predictions for each assigned cohort and merge
        return cohortIds.stream()
                .flatMap(cohortId -> predictionRepository.findLatestByCohort(cohortId).stream())
                .map(BeneficiaryPredictionDto::from)
                // Sort by dropout probability descending (highest risk first)
                .sorted((a, b) -> Double.compare(
                        b.getDropoutProb() != null ? b.getDropoutProb() : 0,
                        a.getDropoutProb() != null ? a.getDropoutProb() : 0))
                .collect(Collectors.toList());
    }

    /**
     * Returns a summary for the officer's caseload:
     * {
     *   total, needsAttention (Dropout + Disengaged), atRisk, active,
     *   cohorts: ["COHORT-SC-001", ...],
     *   lastUpdated: "2026-08-24"
     * }
     *
     * Used by: Case Manager KPI strip.
     */
    public Map<String, Object> getMyCaseloadSummary(Long userId) {
        List<BeneficiaryPredictionDto> caseload = getMyCaseload(userId);

        long needsAttention = caseload.stream()
                .filter(b -> "Dropout".equals(b.getPredictedBand()) || "Disengaged".equals(b.getPredictedBand()))
                .count();
        long atRisk = caseload.stream()
                .filter(b -> "At-Risk".equals(b.getPredictedBand()))
                .count();
        long active = caseload.stream()
                .filter(b -> "Active".equals(b.getPredictedBand()))
                .count();

        List<String> cohorts = assignmentRepository.findCohortIdsByUserId(userId);

        String lastUpdated = caseload.stream()
                .map(BeneficiaryPredictionDto::getAsOfDate)
                .filter(d -> d != null)
                .findFirst()
                .orElse(null);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total",          caseload.size());
        summary.put("needsAttention", needsAttention);
        summary.put("atRisk",         atRisk);
        summary.put("active",         active);
        summary.put("cohorts",        cohorts);
        summary.put("lastUpdated",    lastUpdated);
        return summary;
    }

    /**
     * Returns the assigned cohort IDs for an officer.
     * Used to validate cohort access before serving a cohort-scoped view.
     */
    public List<String> getAssignedCohorts(Long userId) {
        return assignmentRepository.findCohortIdsByUserId(userId);
    }

    /**
     * Returns true if the given officer is assigned to the given cohort.
     * Used for access control checks in the controller.
     */
    public boolean isAssignedToCohort(Long userId, String cohortId) {
        return assignmentRepository.existsByUserIdAndCohortId(userId, cohortId);
    }
}
