package com.sentinel.alert;

import com.sentinel.site.AuditRepository;
import com.sentinel.site.IncidentEntity;
import com.sentinel.site.IncidentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * NarrativeService — generates human-readable alert narratives for the
 * Inuka Foundation's beneficiary monitoring platform.
 *
 * Each narrative is written for the Programme Officer audience: clear context
 * on WHAT is happening, WHY it matters for beneficiary outcomes, and WHAT
 * action to take — without jargon.
 *
 * Four rule templates:
 *   1. RULE_HIGH_REJECT_RATE    → data quality narrative (field data integrity)
 *   2. RULE_CRITICAL_CLUSTER    → dropout spike narrative (cohort at acute risk)
 *   3. RULE_CRITICAL_HIGH_RISK  → high-risk cohort narrative (immediate intervention)
 *   4. RULE_AUDIT_OVERDUE       → field visit gap narrative (engagement lapse)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NarrativeService {

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("d MMM yyyy");

    /** Human-readable cohort display names for Inuka cohorts. */
    private static final Map<String, String> COHORT_DISPLAY_NAMES = Map.ofEntries(
        Map.entry("cohort-sc-001", "Scholarship Cohort — Nairobi"),
        Map.entry("cohort-sc-002", "Scholarship Cohort — Mombasa"),
        Map.entry("cohort-sc-003", "Scholarship Cohort — Nakuru"),
        Map.entry("cohort-sc-007", "Scholarship Cohort — Kisumu"),
        Map.entry("cohort-pl-001", "Plus Cohort — Nairobi"),
        Map.entry("cohort-pl-007", "Plus Cohort — Kisumu"),
        Map.entry("cohort-vn-001", "Vocational Cohort — Nairobi"),
        Map.entry("cohort-vn-003", "Vocational Cohort — Nakuru"),
        Map.entry("cohort-vn-026", "Vocational Cohort — Eldoret"),
        Map.entry("cohort-tc-001", "Tech Cohort — Nairobi"),
        Map.entry("cohort-tc-002", "Tech Cohort — Mombasa"),
        Map.entry("cohort-tc-007", "Tech Cohort — Kisumu")
    );

    /**
     * High-risk cohorts — Inuka programme data shows these cohorts have
     * historically elevated dropout rates and require a 14-day field visit cadence.
     */
    private static final Set<String> HIGH_RISK_COHORTS = Set.of(
        "cohort-vn-003", "cohort-tc-007"
    );

    private final AuditRepository    auditRepository;
    private final IncidentRepository incidentRepository;

    // ── Groq LLM config ───────────────────────────────────────────────────────
    @Value("${sentinel.llm.groq-api-key:}")
    private String groqApiKey;

    @Value("${sentinel.llm.model:llama-3.1-8b-instant}")
    private String groqModel;

    @Value("${sentinel.llm.timeout-ms:3000}")
    private int groqTimeoutMs;

    @Value("${sentinel.llm.enabled:true}")
    private boolean llmEnabled;

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

    private static final String LLM_SYSTEM_PROMPT =
        "You are a Programme Officer writing beneficiary alert narratives for the Inuka Foundation, " +
        "a Kenyan social development organisation. Rewrite the following alert in clear, professional " +
        "prose that a programme officer or foundation director can act on immediately. " +
        "Keep all facts, numbers, cohort names, beneficiary IDs, and risk scores exactly as given. " +
        "Do NOT add speculation or new information. Aim for 3-5 concise sentences. " +
        "Use plain English — no jargon, no legal references, no pipeline language. " +
        "Do not include greetings, headers, or sign-offs — return only the narrative text.";

    // ─────────────────────────────────────────────────────────────────────────
    //  Public API — one method per rule
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Narrative for RULE_HAZARD_REPORT_RISK_RATING (field welfare reports).
     */
    public String forHazardRiskRating(com.sentinel.hazard.HazardReportEntity report, String severity) {
        try {
            String cohort = displayName(report.getSiteId());
            int riskRating = report.getRiskRating() != null ? report.getRiskRating() : 0;
            StringBuilder sb = new StringBuilder();
            sb.append(String.format(
                "⚠ Field welfare report received for %s — escalated to %s. " +
                "Issue category: '%s', assessed risk rating %d/25. ",
                cohort, severity, report.getCategory(), riskRating));
            if (report.getMitigationNote() != null && !report.getMitigationNote().isBlank()) {
                sb.append(String.format("Field officer note: '%s'. ", report.getMitigationNote()));
            }
            sb.append("Programme Officer review and follow-up visit required.");
            return enhanceWithLlm(sb.toString());
        } catch (Exception ex) {
            log.warn("NarrativeService: fallback for HAZARD_REPORT cohort={}", report.getSiteId(), ex);
            return String.format("Field welfare report at %s: risk rating %d/25 — escalated to %s.",
                    displayName(report.getSiteId()),
                    report.getRiskRating() != null ? report.getRiskRating() : 0,
                    severity);
        }
    }

    /**
     * Narrative for RULE_HIGH_REJECT_RATE.
     * Rejection in the Inuka context = beneficiary records failing data quality checks
     * (missing fields, invalid dates, duplicate entries from field data collection).
     */
    public String forHighRejectRate(String cohortId, long rejectedCount,
                                    long totalCount, String rejectedIds) {
        try {
            double rate = totalCount > 0 ? (double) rejectedCount / totalCount * 100 : 0.0;
            String cohort = displayName(cohortId);
            long recentDropouts = safeIncidentCount(cohortId, 30);

            String urgencyLabel;
            String actionLine;
            if (rate >= 50.0) {
                urgencyLabel = "CRITICAL DATA QUALITY FAILURE";
                actionLine = "Immediate investigation of data collection process required. " +
                    "Rejection rates above 50% indicate systematic issues with field data entry " +
                    "or data submission from this cohort's programme officers.";
            } else if (rate >= 25.0) {
                urgencyLabel = "SEVERE DATA QUALITY ISSUE";
                actionLine = "Data coordinator review required within 4 hours. " +
                    "High rejection rates reduce the accuracy of dropout risk predictions for this cohort.";
            } else {
                urgencyLabel = "DATA QUALITY THRESHOLD BREACH";
                actionLine = "Data quality review required within 24 hours to identify " +
                    "and correct the source of rejected beneficiary records.";
            }

            StringBuilder sb = new StringBuilder();
            sb.append(String.format(
                "⚠ %s — %s. %.0f%% of the latest data batch (%d of %d beneficiary records) " +
                "failed quality validation and were rejected, exceeding the 10%% threshold. ",
                urgencyLabel, cohort, rate, rejectedCount, totalCount));

            if (recentDropouts > 0) {
                sb.append(String.format(
                    "This cohort has also recorded %d at-risk beneficiary flag(s) in the past 30 days — " +
                    "data quality gaps make it harder to identify and intervene with those beneficiaries. ",
                    recentDropouts));
            }

            sb.append(actionLine);

            if (rejectedIds != null && !rejectedIds.isBlank()) {
                String preview = Arrays.stream(rejectedIds.split(","))
                        .limit(3)
                        .collect(Collectors.joining(", "));
                long total = rejectedIds.split(",").length;
                sb.append(String.format(" Affected record IDs: %s%s.",
                        preview, total > 3 ? String.format(" (+%d more)", total - 3) : ""));
            }

            return enhanceWithLlm(sb.toString());

        } catch (Exception ex) {
            log.warn("NarrativeService: fallback for RULE_HIGH_REJECT_RATE cohort={}", cohortId, ex);
            return String.format(
                "Data quality alert for %s: rejection rate exceeded 10%% threshold. " +
                "Review required to ensure accurate dropout risk predictions.",
                displayName(cohortId));
        }
    }

    /**
     * Narrative for RULE_CRITICAL_CLUSTER.
     * A critical cluster in Inuka = multiple beneficiaries in one cohort
     * flagged as high/critical dropout risk in a single data batch — indicating
     * a cohort-level problem, not just individual cases.
     */
    public String forCriticalCluster(String cohortId, List<IncidentEntity> incidents) {
        try {
            String cohort = displayName(cohortId);
            long criticalCount = incidents.stream()
                    .filter(i -> "Critical".equalsIgnoreCase(i.getSeverity()))
                    .count();
            long highCount = incidents.stream()
                    .filter(i -> "High".equalsIgnoreCase(i.getSeverity()))
                    .count();

            long totalPast30 = safeIncidentCount(cohortId, 30);
            Optional<String> latestVisit = safeLatestAuditDate(cohortId);
            int daysSinceVisit = latestVisit.map(d -> {
                try {
                    LocalDate visitDate = LocalDate.parse(d.substring(0, 10));
                    return (int) ChronoUnit.DAYS.between(visitDate, LocalDate.now());
                } catch (Exception ignored) { return -1; }
            }).orElse(-1);

            boolean isHighRisk = HIGH_RISK_COHORTS.contains(cohortId);

            StringBuilder sb = new StringBuilder();
            sb.append(String.format(
                "🚨 DROPOUT RISK SPIKE — %s. %d beneficiary/beneficiaries flagged as " +
                "Critical/High dropout risk in a single data cycle — %d Critical, %d High. " +
                "A cluster of this size suggests a cohort-level issue rather than isolated cases: " +
                "programme disruption, missed disbursements, or reduced engagement across the group. ",
                cohort, incidents.size(), criticalCount, highCount));

            if (totalPast30 > incidents.size()) {
                sb.append(String.format(
                    "Context: this cohort has had %d at-risk flags in the past 30 days, " +
                    "indicating a sustained — not one-off — disengagement trend. ", totalPast30));
            }

            if (daysSinceVisit > 14) {
                sb.append(String.format(
                    "The last recorded field visit was %d days ago — without a recent visit, " +
                    "the programme officer may be unaware of conditions driving this spike. ",
                    daysSinceVisit));
            } else if (daysSinceVisit > 0) {
                sb.append(String.format("Last field visit: %d days ago. ", daysSinceVisit));
            }

            if (isHighRisk) {
                sb.append(
                    "⚑ HIGH-RISK COHORT: this cohort is on the Inuka watch list due to " +
                    "historically elevated dropout rates. Escalation to Programme Director required immediately. ");
            }

            sb.append("Recommended action: the assigned programme officer should conduct " +
                      "an urgent cohort check-in, review recent attendance and disbursement records, " +
                      "and escalate to the Programme Director if cohort-level intervention is needed.");

            return enhanceWithLlm(sb.toString());

        } catch (Exception ex) {
            log.warn("NarrativeService: fallback for RULE_CRITICAL_CLUSTER cohort={}", cohortId, ex);
            return String.format(
                "Dropout risk cluster at %s: %d beneficiaries flagged as Critical/High risk. " +
                "Programme officer follow-up required immediately.",
                displayName(cohortId),
                incidents != null ? incidents.size() : 0);
        }
    }

    /**
     * Narrative for RULE_CRITICAL_HIGH_RISK.
     * A critical incident at a high-risk cohort in Inuka = a beneficiary with
     * very high dropout probability (≥70%) in a cohort that already has a
     * history of elevated dropout rates.
     */
    public String forCriticalHighRisk(String cohortId, IncidentEntity incident) {
        try {
            String cohort = displayName(cohortId);
            long totalPast30 = safeIncidentCount(cohortId, 30);
            Optional<String> latestVisit = safeLatestAuditDate(cohortId);
            int daysSinceVisit = latestVisit.map(d -> {
                try {
                    LocalDate visitDate = LocalDate.parse(d.substring(0, 10));
                    return (int) ChronoUnit.DAYS.between(visitDate, LocalDate.now());
                } catch (Exception ignored) { return -1; }
            }).orElse(-1);

            String beneficiaryRef = incident != null ? incident.getIncidentId() : "unknown";
            String incidentDesc   = incident != null && incident.getDescription() != null
                    ? incident.getDescription()
                    : "Critical dropout risk detected";

            StringBuilder sb = new StringBuilder();
            sb.append(String.format(
                "🔴 CRITICAL DROPOUT RISK — HIGH-RISK COHORT: %s. " +
                "Beneficiary record %s has been flagged at Critical severity by the dropout model. " +
                "This cohort is on the Inuka high-risk watch list due to consistently elevated " +
                "disengagement patterns. ",
                cohort, beneficiaryRef));

            sb.append(String.format("Risk details: %s. ", incidentDesc));

            if (totalPast30 > 1) {
                sb.append(String.format(
                    "This is the %d%s at-risk flag for this cohort in the past 30 days — " +
                    "frequency of alerts indicates a deepening engagement problem. ",
                    totalPast30, ordinalSuffix(totalPast30)));
            }

            if (daysSinceVisit >= 14) {
                sb.append(String.format(
                    "⚠ Field visit gap: last programme officer visit was %d days ago " +
                    "(recommended frequency: every 14 days for high-risk cohorts). " +
                    "A visit is overdue and should be prioritised immediately. ", daysSinceVisit));
            } else if (daysSinceVisit > 0) {
                sb.append(String.format("Last field visit: %d days ago. ", daysSinceVisit));
            }

            sb.append("REQUIRED ACTION: Programme Officer must contact the beneficiary and " +
                      "conduct a welfare check within 48 hours. Escalate to Programme Director " +
                      "if the beneficiary is unreachable or has already disengaged.");

            return enhanceWithLlm(sb.toString());

        } catch (Exception ex) {
            log.warn("NarrativeService: fallback for RULE_CRITICAL_HIGH_RISK cohort={}", cohortId, ex);
            return String.format(
                "Critical dropout risk at high-risk cohort %s. " +
                "Immediate Programme Officer contact with beneficiary required.",
                displayName(cohortId));
        }
    }

    /**
     * Narrative for RULE_AUDIT_OVERDUE.
     * "Audit overdue" in Inuka = a high-risk cohort has not had a field visit
     * within the 14-day recommended cadence.
     */
    public String forAuditOverdue(String cohortId, int daysSince) {
        try {
            String cohort = displayName(cohortId);
            long recentFlags = safeIncidentCount(cohortId, 30);
            boolean isHighRisk = HIGH_RISK_COHORTS.contains(cohortId);

            String visitStatus;
            String urgency;
            if (daysSince >= 999) {
                visitStatus = "NO FIELD VISIT ON RECORD";
                urgency = "CRITICAL ENGAGEMENT GAP";
            } else if (daysSince >= 30) {
                visitStatus = String.format("%d days since last visit (%.1fx the 14-day target)",
                        daysSince, (double) daysSince / 14);
                urgency = "CRITICAL ENGAGEMENT GAP";
            } else {
                visitStatus = String.format("%d days since last visit (%d days overdue)",
                        daysSince, daysSince - 14);
                urgency = "FIELD VISIT OVERDUE";
            }

            StringBuilder sb = new StringBuilder();
            sb.append(String.format(
                "📋 %s — %s. " +
                "High-risk cohorts require a programme officer field visit at least every 14 days. " +
                "The last recorded visit to %s was %s. ",
                urgency, cohort, cohort, visitStatus));

            if (isHighRisk) {
                sb.append(
                    "⚑ HIGH-RISK COHORT: this cohort has a history of elevated dropout rates. " +
                    "Without regular field contact, early warning signs of disengagement go undetected. ");
            }

            if (recentFlags > 0) {
                sb.append(String.format(
                    "Compounding factor: %d beneficiary/beneficiaries in this cohort have been " +
                    "flagged as at-risk in the last 30 days while the visit gap has been building. ",
                    recentFlags));
            }

            sb.append("Required action: schedule a field visit within 48 hours. " +
                      "During the visit, check attendance, disbursement status, and wellbeing " +
                      "for the flagged beneficiaries. Notify the Programme Director if a visit " +
                      "cannot be completed within 48 hours.");

            return enhanceWithLlm(sb.toString());

        } catch (Exception ex) {
            log.warn("NarrativeService: fallback for RULE_AUDIT_OVERDUE cohort={}", cohortId, ex);
            int days = daysSince == 999 ? -1 : daysSince;
            return String.format(
                "Field visit overdue for high-risk cohort %s. %s. " +
                "Programme Officer visit required within 48 hours.",
                displayName(cohortId),
                days > 0 ? "Last visit " + days + " days ago" : "No visit on record");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LLM enhancement — Groq API with template fallback
    // ─────────────────────────────────────────────────────────────────────────

    private String enhanceWithLlm(String templateNarrative) {
        if (!llmEnabled || groqApiKey == null || groqApiKey.isBlank()) {
            return templateNarrative;
        }
        try {
            RestTemplate restTemplate = new RestTemplate();
            org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                    new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(groqTimeoutMs);
            factory.setReadTimeout(groqTimeoutMs);
            restTemplate.setRequestFactory(factory);

            Map<String, Object> userMessage   = Map.of("role", "user",   "content", templateNarrative);
            Map<String, Object> systemMessage = Map.of("role", "system", "content", LLM_SYSTEM_PROMPT);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model",       groqModel);
            body.put("messages",    List.of(systemMessage, userMessage));
            body.put("max_tokens",  400);
            body.put("temperature", 0.3);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(groqApiKey);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(GROQ_URL, request, Map.class);
            if (response == null) return templateNarrative;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            if (choices == null || choices.isEmpty()) return templateNarrative;

            @SuppressWarnings("unchecked")
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            if (message == null) return templateNarrative;

            String content = (String) message.get("content");
            if (content == null || content.isBlank()) return templateNarrative;

            log.info("NarrativeService: LLM enhancement succeeded ({} chars → {} chars)",
                    templateNarrative.length(), content.length());
            return content.trim();

        } catch (Exception ex) {
            log.debug("NarrativeService: LLM enhancement failed (template fallback): {}", ex.getMessage());
            return templateNarrative;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String displayName(String cohortId) {
        if (cohortId == null) return "Unknown Cohort";
        return COHORT_DISPLAY_NAMES.getOrDefault(cohortId,
                cohortId.replace("-", " ").toUpperCase());
    }

    private long safeIncidentCount(String cohortId, int days) {
        try {
            LocalDateTime since = LocalDateTime.now().minusDays(days);
            return incidentRepository.countBySiteIdAndIncidentDateAfter(cohortId, since);
        } catch (Exception ex) {
            log.debug("NarrativeService: could not query incident count for cohort={}", cohortId);
            return 0L;
        }
    }

    private Optional<String> safeLatestAuditDate(String cohortId) {
        try {
            return auditRepository.findLatestAuditDateBySite().stream()
                    .filter(row -> cohortId.equals(row[0]))
                    .findFirst()
                    .map(row -> row[1] != null ? row[1].toString() : null);
        } catch (Exception ex) {
            log.debug("NarrativeService: could not query visit date for cohort={}", cohortId);
            return Optional.empty();
        }
    }

    private static String ordinalSuffix(long n) {
        if (n % 100 >= 11 && n % 100 <= 13) return "th";
        return switch ((int)(n % 10)) { case 1 -> "st"; case 2 -> "nd"; case 3 -> "rd"; default -> "th"; };
    }
}
