import type {
  Alert,
  DataQualitySummary,
  IngestBatch,
  SiteDetail,
  SiteRiskSummary,
} from "@/lib/inuka-pulse/types";

// ─── Mock Cohorts (Risk Summary) — Inuka 4 pillars × 5 counties ────────────
// siteId      → cohort_id      (COHORT-{PILLAR}-{COUNTY_CODE})
// siteName    → cohort name    (Pillar — County)
// riskScore   → vulnerability score (0-100)
// severityBand→ engagement band: Critical=Dropout risk, High=Disengaged, etc.
// incidentCount → beneficiaries flagged at-risk
// pressureSpikeCount → missed disbursements this month
// daysSinceLastAudit → days since last field officer visit

export const mockSites: SiteRiskSummary[] = [
  // ── Scholarship pillar ──────────────────────────────────────────────────
  {
    siteId: "cohort-sc-001",
    siteName: "Scholarship — Nairobi",
    riskScore: 38,
    severityBand: "Low",
    incidentCount: 4,
    lastAuditDate: "2026-08-18",
    daysSinceLastAudit: 3,
    correctedRate: 0.03,
    rejectedRate: 0.02,
    latitude: -1.295,
    longitude: 36.831,
    pressureSpikeCount: 1,
  },
  {
    siteId: "cohort-sc-002",
    siteName: "Scholarship — Mombasa",
    riskScore: 52,
    severityBand: "Medium",
    incidentCount: 7,
    lastAuditDate: "2026-08-10",
    daysSinceLastAudit: 11,
    correctedRate: 0.05,
    rejectedRate: 0.06,
    latitude: -4.055,
    longitude: 39.658,
    pressureSpikeCount: 2,
  },
  {
    siteId: "cohort-sc-026",
    siteName: "Scholarship — Eldoret",
    riskScore: 44,
    severityBand: "Medium",
    incidentCount: 5,
    lastAuditDate: "2026-08-14",
    daysSinceLastAudit: 7,
    correctedRate: 0.04,
    rejectedRate: 0.04,
    latitude: 0.524,
    longitude: 35.274,
    pressureSpikeCount: 1,
  },
  // ── Plus pillar ─────────────────────────────────────────────────────────
  {
    siteId: "cohort-pl-001",
    siteName: "Plus — Nairobi",
    riskScore: 61,
    severityBand: "High",
    incidentCount: 11,
    lastAuditDate: "2026-08-08",
    daysSinceLastAudit: 13,
    correctedRate: 0.07,
    rejectedRate: 0.11,
    latitude: -1.278,
    longitude: 36.809,
    pressureSpikeCount: 3,
  },
  {
    siteId: "cohort-pl-007",
    siteName: "Plus — Kisumu",
    riskScore: 47,
    severityBand: "Medium",
    incidentCount: 6,
    lastAuditDate: "2026-08-16",
    daysSinceLastAudit: 5,
    correctedRate: 0.04,
    rejectedRate: 0.05,
    latitude: -0.115,
    longitude: 34.755,
    pressureSpikeCount: 1,
  },
  // ── Vocational pillar — COHORT-VN-003 is high-risk ─────────────────────
  {
    siteId: "cohort-vn-003",
    siteName: "Vocational — Nakuru",
    riskScore: 84,
    severityBand: "Critical",
    incidentCount: 19,
    lastAuditDate: "2026-07-28",
    daysSinceLastAudit: 24,
    correctedRate: 0.13,
    rejectedRate: 0.21,
    latitude: -0.312,
    longitude: 36.087,
    pressureSpikeCount: 5,
  },
  {
    siteId: "cohort-vn-001",
    siteName: "Vocational — Nairobi",
    riskScore: 55,
    severityBand: "Medium",
    incidentCount: 8,
    lastAuditDate: "2026-08-12",
    daysSinceLastAudit: 9,
    correctedRate: 0.06,
    rejectedRate: 0.08,
    latitude: -1.302,
    longitude: 36.843,
    pressureSpikeCount: 2,
  },
  {
    siteId: "cohort-vn-026",
    siteName: "Vocational — Eldoret",
    riskScore: 48,
    severityBand: "Medium",
    incidentCount: 6,
    lastAuditDate: "2026-08-15",
    daysSinceLastAudit: 6,
    correctedRate: 0.05,
    rejectedRate: 0.06,
    latitude: 0.508,
    longitude: 35.261,
    pressureSpikeCount: 1,
  },
  // ── Tech pillar — COHORT-TC-007 is high-risk ────────────────────────────
  {
    siteId: "cohort-tc-007",
    siteName: "Tech — Kisumu",
    riskScore: 78,
    severityBand: "High",
    incidentCount: 15,
    lastAuditDate: "2026-07-31",
    daysSinceLastAudit: 21,
    correctedRate: 0.10,
    rejectedRate: 0.19,
    latitude: -0.091,
    longitude: 34.769,
    pressureSpikeCount: 4,
  },
  {
    siteId: "cohort-tc-001",
    siteName: "Tech — Nairobi",
    riskScore: 42,
    severityBand: "Low",
    incidentCount: 4,
    lastAuditDate: "2026-08-19",
    daysSinceLastAudit: 2,
    correctedRate: 0.03,
    rejectedRate: 0.02,
    latitude: -1.268,
    longitude: 36.820,
    pressureSpikeCount: 0,
  },
  {
    siteId: "cohort-tc-002",
    siteName: "Tech — Mombasa",
    riskScore: 57,
    severityBand: "Medium",
    incidentCount: 9,
    lastAuditDate: "2026-08-09",
    daysSinceLastAudit: 12,
    correctedRate: 0.06,
    rejectedRate: 0.09,
    latitude: -4.038,
    longitude: 39.680,
    pressureSpikeCount: 2,
  },
];


// ─── Mock Alerts — Inuka vocabulary ────────────────────────────────────────

export const mockAlerts: Alert[] = [
  {
    id: "alert-001",
    siteId: "cohort-vn-003",
    siteName: "Vocational — Nakuru",
    severity: "Critical",
    status: "active",
    title: "EWMA breach — Vocational Nakuru attendance collapsing",
    description:
      "Weekly attendance EWMA (41%) crossed the lower control limit (52%) on 2026-08-14. " +
      "19 beneficiaries now flagged as Disengaged. Immediate field officer follow-up required.",
    rule: "EWMA attendance LCL breach (inuka_diagnostics.py)",
    recordIds: ["BEN-00312", "BEN-00318", "BEN-00341"],
    createdAt: "2026-08-14T07:30:00Z",
  },
  {
    id: "alert-002",
    siteId: "cohort-tc-007",
    siteName: "Tech — Kisumu",
    severity: "Critical",
    status: "active",
    title: "Disbursement delay spike — Tech Kisumu",
    description:
      "Average disbursement delay reached 18 days for Tech — Kisumu cohort. " +
      "Pearson r=0.41 between payment delays and dropout rate. " +
      "4 beneficiaries have missed 2+ consecutive disbursements.",
    rule: "Avg disbursement delay > 14 days (high-risk cohort threshold)",
    recordIds: ["DISB-0041203", "DISB-0041208"],
    createdAt: "2026-08-15T09:00:00Z",
  },
  {
    id: "alert-003",
    siteId: "cohort-vn-003",
    siteName: "Vocational — Nakuru",
    severity: "High",
    status: "active",
    title: "Field visit gap — Vocational Nakuru (24 days)",
    description:
      "Last field officer visit to Vocational — Nakuru cohort was 24 days ago. " +
      "Threshold for high-risk cohorts is 14 days. 6 beneficiaries have no contact in 30+ days.",
    rule: "Field visit gap > 14 days (high-risk cohort)",
    recordIds: [],
    createdAt: "2026-08-15T06:00:00Z",
  },
  {
    id: "alert-004",
    siteId: "cohort-tc-007",
    siteName: "Tech — Kisumu",
    severity: "High",
    status: "acknowledged",
    title: "Model flagged 15 dropout-risk beneficiaries — Tech Kisumu",
    description:
      "Dropout prediction model (F1=0.464, recall=0.679) flagged 15 beneficiaries at ≥70% dropout probability. " +
      "Top risk driver: attendance_rate_30d (28.1%). Field interventions logged for 9; 6 remain uncontacted.",
    rule: "Dropout probability ≥ 0.70 (inuka_logreg_v1)",
    recordIds: ["BEN-01102", "BEN-01109", "BEN-01117"],
    createdAt: "2026-08-13T14:30:00Z",
    acknowledgedAt: "2026-08-13T15:00:00Z",
    acknowledgedBy: "officer@inuka.org",
  },
  {
    id: "alert-005",
    siteId: "cohort-pl-001",
    siteName: "Plus — Nairobi",
    severity: "Medium",
    status: "active",
    title: "Future enrollment date detected — batch b-0021",
    description:
      "Record BEN-00891 has enrollment_date (2026-08-25) after ingestion date (2026-08-21). " +
      "Record quarantined pending manual verification.",
    rule: "No future dates (validate rule — inuka pipeline)",
    recordIds: ["BEN-00891"],
    createdAt: "2026-08-21T08:00:00Z",
  },
  {
    id: "alert-006",
    siteId: "cohort-sc-002",
    siteName: "Scholarship — Mombasa",
    severity: "High",
    status: "resolved",
    title: "Assessment score drop — Scholarship Mombasa (wave 2)",
    description:
      "Average wave-2 assessment score for Scholarship — Mombasa fell 11 points vs wave-1. " +
      "7 beneficiaries now below the 40-point intervention threshold.",
    rule: "Assessment score trend < -8 (cohort average)",
    recordIds: ["ASMT-000412", "ASMT-000418"],
    createdAt: "2026-08-10T16:00:00Z",
    acknowledgedAt: "2026-08-10T17:00:00Z",
    acknowledgedBy: "admin@inuka.org",
  },
  {
    id: "alert-007",
    siteId: "cohort-vn-001",
    siteName: "Vocational — Nairobi",
    severity: "Low",
    status: "resolved",
    title: "Disbursement status label corrected — batch b-0019",
    description:
      "9 disbursement records had status 'paid' (lowercase) — auto-normalized to 'Paid'. " +
      "Logged as corrected in batch b-0019.",
    rule: "Dirty label normalization (disbursement status)",
    recordIds: ["DISB-0039101"],
    createdAt: "2026-08-08T09:00:00Z",
    acknowledgedAt: "2026-08-08T09:15:00Z",
    acknowledgedBy: "analyst@inuka.org",
  },
];

// ─── Mock Data Quality Summary — Inuka pipeline ─────────────────────────────

export const mockQualitySummary: DataQualitySummary = {
  trusted: 11284,
  corrected: 1203,
  review: 489,
  rejected: 241,
  total: 13217,
  passRate: 0.9419,
  gateStatus: "passed",
  threshold: 0.9,
  lastBatchId: "b-0021",
  lastBatchDate: "2026-08-21T06:00:00Z",
};

// ─── Mock Ingest Batches — Inuka pipeline ────────────────────────────────────

export const mockBatches: IngestBatch[] = [
  {
    batchId: "b-0021",
    sourceFilename: "fact_sessions_2026-08-21.csv",
    rowCount: 1840,
    sha256Checksum: "a3f2c8e1d4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1",
    ingestedAt: "2026-08-21T06:00:00Z",
    trustedCount: 1648,
    correctedCount: 122,
    reviewCount: 48,
    rejectedCount: 22,
  },
  {
    batchId: "b-0020",
    sourceFilename: "fact_disbursements_2026-08-18.csv",
    rowCount: 982,
    sha256Checksum: "b4e3d9f2a5c6b7a8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2",
    ingestedAt: "2026-08-18T06:00:00Z",
    trustedCount: 881,
    correctedCount: 68,
    reviewCount: 22,
    rejectedCount: 11,
  },
  {
    batchId: "b-0019",
    sourceFilename: "fact_sessions_2026-08-14.csv",
    rowCount: 1790,
    sha256Checksum: "c5f4e0a3b6d7c8b9a0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3",
    ingestedAt: "2026-08-14T06:00:00Z",
    trustedCount: 1604,
    correctedCount: 115,
    reviewCount: 46,
    rejectedCount: 25,
  },
  {
    batchId: "b-0018",
    sourceFilename: "fact_field_visits_2026-08-12.csv",
    rowCount: 341,
    sha256Checksum: "d6a5f1b4c7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4",
    ingestedAt: "2026-08-12T06:00:00Z",
    trustedCount: 308,
    correctedCount: 24,
    reviewCount: 7,
    rejectedCount: 2,
  },
  {
    batchId: "b-0017",
    sourceFilename: "fact_assessments_2026-08-10.csv",
    rowCount: 420,
    sha256Checksum: "e7b6a2c5d8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5",
    ingestedAt: "2026-08-10T06:00:00Z",
    trustedCount: 381,
    correctedCount: 28,
    reviewCount: 9,
    rejectedCount: 2,
  },
];

// ─── Mock Cohort Detail ──────────────────────────────────────────────────────

const mockSiteDetails: Record<string, SiteDetail> = {
  "cohort-vn-003": {
    siteId: "cohort-vn-003",
    siteName: "Vocational — Nakuru",
    location: "Nakuru County, Rift Valley",
    riskScore: 84,
    severityBand: "Critical",
    latitude: -0.312,
    longitude: 36.087,
    pressureSpikeCount: 5,
    incidentCount: 8,
    critHighCount: 6,
    daysSinceAudit: 24,
    rejectedRate: 0.21,
    telemetryReadings: [],
    incidents: [
      {
        incidentId: "EVT-2026-0312",
        siteId: "cohort-vn-003",
        incidentDate: "2026-08-19",
        severity: "Critical",
        description: "BEN-00312: 4 consecutive missed sessions, no field visit in 18 days. Dropout probability 0.87.",
        complianceScore: 28,
        decision: "rejected",
        decisionReason: "Dropout probability exceeds 0.80 critical threshold",
      },
      {
        incidentId: "EVT-2026-0318",
        siteId: "cohort-vn-003",
        incidentDate: "2026-08-18",
        severity: "High",
        description: "BEN-00318: Disbursement withheld (2nd consecutive month). Attendance rate 35% in last 30 days.",
        complianceScore: 42,
        decision: "review",
        decisionReason: "Disbursement withheld + attendance below 40% threshold",
      },
      {
        incidentId: "EVT-2026-0341",
        siteId: "cohort-vn-003",
        incidentDate: "2026-08-15",
        severity: "High",
        description: "BEN-00341: Assessment score dropped from 62 to 41 (wave 2). At-risk for disengagement.",
        complianceScore: 55,
        decision: "trusted",
        decisionReason: "All validation rules pass — flagged by model",
      },
      {
        incidentId: "EVT-2026-0290",
        siteId: "cohort-vn-003",
        incidentDate: "2026-08-10",
        severity: "Medium",
        description: "BEN-00290: No contact visit outcome — officer unable to reach beneficiary at 2 home visits.",
        complianceScore: 65,
        decision: "corrected",
        decisionReason: "Visit outcome normalized from 'no contact' to 'No Contact'",
      },
    ],
    audits: [
      {
        auditId: "FV-002841",
        siteId: "cohort-vn-003",
        inspectionDate: "2026-07-28",
        auditor: "Grace Wanjiku",
        findings:
          "3 beneficiaries unreachable. Cohort attendance rate 48% — below 60% program threshold. " +
          "Skills lab sessions rescheduled due to venue issues.",
        complianceScore: 44,
        followUpRequired: true,
      },
      {
        auditId: "FV-002201",
        siteId: "cohort-vn-003",
        inspectionDate: "2026-07-01",
        auditor: "Brian Omondi",
        findings:
          "Cohort engagement declining since week 8. Transport barriers cited by 6 beneficiaries. " +
          "Recommended transport allowance review.",
        complianceScore: 51,
        followUpRequired: true,
      },
    ],
  },
  "cohort-tc-007": {
    siteId: "cohort-tc-007",
    siteName: "Tech — Kisumu",
    location: "Kisumu County, Nyanza",
    riskScore: 78,
    severityBand: "High",
    latitude: -0.091,
    longitude: 34.769,
    pressureSpikeCount: 4,
    incidentCount: 6,
    critHighCount: 4,
    daysSinceAudit: 21,
    rejectedRate: 0.19,
    telemetryReadings: [],
    incidents: [
      {
        incidentId: "EVT-2026-1102",
        siteId: "cohort-tc-007",
        incidentDate: "2026-08-18",
        severity: "Critical",
        description: "BEN-01102: Disbursement delayed 22 days (2nd consecutive). Session attendance 28%. Dropout prob 0.81.",
        complianceScore: 31,
        decision: "review",
        decisionReason: "Dropout probability exceeds 0.80 — pending officer verification",
      },
      {
        incidentId: "EVT-2026-1109",
        siteId: "cohort-tc-007",
        incidentDate: "2026-08-17",
        severity: "High",
        description: "BEN-01109: 3 missed sessions in last 14 days. Last field visit 19 days ago. At-risk status confirmed.",
        complianceScore: 48,
        decision: "trusted",
        decisionReason: "All validation rules pass",
      },
      {
        incidentId: "EVT-2026-1117",
        siteId: "cohort-tc-007",
        incidentDate: "2026-08-16",
        severity: "High",
        description: "BEN-01117: Assessment score 38 (below minimum threshold 40). Referred to mentorship program.",
        complianceScore: 52,
        decision: "trusted",
        decisionReason: "All validation rules pass",
      },
    ],
    audits: [
      {
        auditId: "FV-003102",
        siteId: "cohort-tc-007",
        inspectionDate: "2026-07-31",
        auditor: "Esther Adhiambo",
        findings:
          "Disbursement delays affecting 8 beneficiaries — M-Pesa account verification backlog. " +
          "3 beneficiaries relocated; addresses require update. Follow-up visits scheduled.",
        complianceScore: 47,
        followUpRequired: true,
      },
      {
        auditId: "FV-002680",
        siteId: "cohort-tc-007",
        inspectionDate: "2026-07-05",
        auditor: "Patrick Kiprotich",
        findings:
          "Tech lab equipment shortage limiting hands-on sessions. 4 beneficiaries commuting from Ahero — " +
          "transport support requested.",
        complianceScore: 56,
        followUpRequired: true,
      },
    ],
  },
};

export function getMockSiteDetail(siteId: string): SiteDetail {
  if (mockSiteDetails[siteId]) {
    return mockSiteDetails[siteId];
  }
  const site = mockSites.find((s) => s.siteId === siteId);
  return {
    siteId,
    siteName: site?.siteName ?? `Cohort ${siteId}`,
    location: "Kenya",
    riskScore: site?.riskScore ?? 0,
    severityBand: site?.severityBand ?? "Low",
    latitude: site?.latitude ?? 0,
    longitude: site?.longitude ?? 0,
    pressureSpikeCount: 0,
    incidentCount: 0,
    critHighCount: 0,
    daysSinceAudit: 30,
    rejectedRate: 0,
    telemetryReadings: [],
    incidents: [],
    audits: [],
  };
}
