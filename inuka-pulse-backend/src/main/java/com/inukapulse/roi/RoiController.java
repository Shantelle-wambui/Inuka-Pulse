package com.inukapulse.roi;

import com.inukapulse.analytics.AnalyticsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * RoiController — programme impact ROI calculator for the Inuka Foundation.
 *
 * Estimates the cost-benefit value of early dropout intervention against
 * the cost of re-enrolment, lost programme investment, and donor reporting impact.
 *
 * All figures are parameterised and user-visible — this is a planning tool,
 * not a financial guarantee.
 */
@RestController
@RequestMapping("/api/analytics/roi")
@RequiredArgsConstructor
@Slf4j
public class RoiController {

    private final AnalyticsService analyticsService;
    private final ObjectMapper objectMapper;

    private static final String DISCLAIMER =
        "All figures derive from explicit, user-visible programme assumptions. " +
        "This is a planning tool to estimate the value of early dropout intervention — " +
        "not a financial guarantee or audit outcome.";

    /**
     * Returns programme ROI reference assumptions used in the calculator.
     * These mirror the values established in the Inuka Foundation programme model.
     */
    @GetMapping("/reference-cases")
    public ResponseEntity<?> getReferenceCase() {
        Map<String, Object> defaults = new LinkedHashMap<>();
        defaults.put("description", "Inuka Foundation — programme investment ROI assumptions");
        defaults.put("interventionSuccessProbability", 0.70);
        defaults.put("costPerDropoutKes", 85_000.0);
        defaults.put("nHighRiskBeneficiaries", 12);
        defaults.put("annualPlatformCostKes", null);
        defaults.put("disclaimer", DISCLAIMER);
        return ResponseEntity.ok(defaults);
    }

    /**
     * Calculates expected ROI of early dropout intervention.
     *
     * Formula:
     *   expectedSaved = interventionProbability × costPerDropout × nHighRiskBeneficiaries
     *   netBenefit    = expectedSaved − platformCost  (if provided)
     *   roiPct        = netBenefit / platformCost × 100
     *
     * costPerDropout represents the combined cost of:
     *   - Re-enrolment and re-onboarding (admin, assessments)
     *   - Lost programme investment already disbursed to the beneficiary
     *   - Donor reporting impact (programme completion rate metrics)
     */
    @PostMapping("/calculate")
    public ResponseEntity<Map<String, Object>> calculate(@RequestBody Map<String, Object> body) {
        try {
            double interventionProbability  = toDouble(body.getOrDefault("interventionProbability",  0.70));
            double costPerDropoutKes        = toDouble(body.getOrDefault("costPerDropoutKes",        85_000.0));
            int    nHighRiskBeneficiaries   = toInt(body.getOrDefault("nHighRiskBeneficiaries",      12));
            Object platformCostObj          = body.get("annualPlatformCostKes");

            // Read lead_time_days from pre-computed control chart analytics
            double leadTimeDays = 17.1; // default from inuka_control_chart_data.json
            try {
                ResponseEntity<String> simResult = analyticsService.getRoiSimulationResult();
                if (simResult.getStatusCode().is2xxSuccessful() && simResult.getBody() != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> sim = objectMapper.readValue(simResult.getBody(), Map.class);
                    if (sim.get("lead_time_days") instanceof Number n) {
                        leadTimeDays = n.doubleValue();
                    }
                }
            } catch (Exception ex) {
                log.debug("RoiController: could not read roi_simulation_result.json, using default: {}", ex.getMessage());
            }

            // Core formula
            double expectedSaved = interventionProbability * costPerDropoutKes * nHighRiskBeneficiaries;

            Map<String, Object> breakdown = new LinkedHashMap<>();
            breakdown.put("interventionProbability",  interventionProbability);
            breakdown.put("costPerDropoutKes",         costPerDropoutKes);
            breakdown.put("nHighRiskBeneficiaries",    nHighRiskBeneficiaries);
            breakdown.put("expectedSavedKes",          expectedSaved);

            Double netBenefit = null;
            Double roiPct     = null;
            if (platformCostObj != null) {
                double platformCost = toDouble(platformCostObj);
                if (platformCost > 0) {
                    netBenefit = expectedSaved - platformCost;
                    roiPct     = netBenefit / platformCost * 100;
                    breakdown.put("annualPlatformCostKes", platformCost);
                    breakdown.put("netBenefitKes",          netBenefit);
                    breakdown.put("roiPct",                 roiPct);
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("leadTimeDays",              leadTimeDays);
            result.put("leadTimeSource",            "EWMA simulation — Inuka beneficiary engagement scenario");
            result.put("expectedSavedKes",          expectedSaved);
            result.put("netBenefitKes",             netBenefit);
            result.put("roiPct",                    roiPct);
            result.put("breakdown",                 breakdown);
            result.put("disclaimer",                DISCLAIMER);
            return ResponseEntity.ok(result);

        } catch (Exception ex) {
            log.error("RoiController: calculation error: {}", ex.getMessage(), ex);
            return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
        }
    }

    private double toDouble(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        return Double.parseDouble(o.toString());
    }

    private int toInt(Object o) {
        if (o instanceof Number n) return n.intValue();
        return Integer.parseInt(o.toString());
    }
}
