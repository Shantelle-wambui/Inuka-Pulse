import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "./shared/report-header";
import { ReportFooter } from "./shared/report-footer";
import { KpiRow } from "./shared/kpi-row";
import { PdfTable } from "./shared/pdf-table";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, fontFamily: "Helvetica" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1a1a1a", marginBottom: 8 },
  note: { fontSize: 8, color: "#666", marginTop: 4 },
});

interface CohortData {
  siteId: string;
  siteName: string;
  riskScore: number;
  severityBand: string;
  incidentCount: number;
  pressureSpikeCount: number;
  daysSinceLastAudit: number;
  rejectedRate: number;
}

export interface CohortPerformanceData {
  cohorts: CohortData[];
  filters?: Record<string, string | undefined>;
}

export function CohortPerformanceReport({ data }: { data: CohortPerformanceData }) {
  const { cohorts, filters } = data;

  const critical = cohorts.filter((c) => c.severityBand === "Critical").length;
  const high = cohorts.filter((c) => c.severityBand === "High").length;
  const avgScore = cohorts.length > 0
    ? Math.round(cohorts.reduce((sum, c) => sum + c.riskScore, 0) / cohorts.length)
    : 0;
  const overdueVisits = cohorts.filter((c) => c.daysSinceLastAudit > 14).length;

  const tableData = cohorts
    .sort((a, b) => b.riskScore - a.riskScore)
    .map((c) => ({
      cohort: c.siteName,
      band: c.severityBand,
      score: `${c.riskScore}/100`,
      atRisk: String(c.incidentCount),
      missed: String(c.pressureSpikeCount),
      daysSinceVisit: `${c.daysSinceLastAudit}d`,
      rejected: `${(c.rejectedRate * 100).toFixed(1)}%`,
    }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Cohort Performance Report" filters={filters} />

        <KpiRow
          items={[
            { label: "Total Cohorts", value: cohorts.length, color: "#00999E" },
            { label: "Critical", value: critical, color: "#dc2626" },
            { label: "High Risk", value: high, color: "#f59e0b" },
            { label: "Avg Risk Score", value: `${avgScore}/100` },
            { label: "Overdue Visits", value: overdueVisits, color: "#C42152" },
          ]}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cohort Vulnerability Summary</Text>
          <PdfTable
            columns={[
              { key: "cohort", header: "Cohort", width: 2 },
              { key: "band", header: "Band", width: 1 },
              { key: "score", header: "Score", width: 0.8, align: "center" },
              { key: "atRisk", header: "At-Risk", width: 0.7, align: "center" },
              { key: "missed", header: "Missed", width: 0.7, align: "center" },
              { key: "daysSinceVisit", header: "Days Since Visit", width: 1, align: "center" },
              { key: "rejected", header: "Rejected %", width: 0.8, align: "center" },
            ]}
            data={tableData}
          />
        </View>

        <Text style={styles.note}>
          Note: "At-Risk" = beneficiaries flagged by ML model. "Missed" = disbursements missed in last 60 days.
          Cohorts with &gt;14 days since last field visit are flagged as overdue.
        </Text>

        <ReportFooter />
      </Page>
    </Document>
  );
}
