import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "./shared/report-header";
import { ReportFooter } from "./shared/report-footer";
import { KpiRow } from "./shared/kpi-row";
import { PdfTable } from "./shared/pdf-table";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, fontFamily: "Helvetica" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1a1a1a", marginBottom: 8 },
  narrativeBox: {
    backgroundColor: "#fff5f7",
    borderLeft: "3px solid #C42152",
    padding: "8px 10px",
    marginBottom: 6,
    borderRadius: 2,
  },
  narrativeTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#C42152" },
  narrativeText: { fontSize: 8, color: "#333", marginTop: 3, lineHeight: 1.4 },
  narrativeMeta: { fontSize: 7, color: "#999", marginTop: 2 },
});

interface AlertData {
  id: string;
  siteName: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  rule: string;
  createdAt: string;
  narrative?: string;
}

export interface AlertDigestData {
  alerts: AlertData[];
  filters?: Record<string, string | undefined>;
}

export function AlertDigestReport({ data }: { data: AlertDigestData }) {
  const { alerts, filters } = data;

  const critical = alerts.filter((a) => a.severity === "Critical").length;
  const high = alerts.filter((a) => a.severity === "High").length;
  const unacked = alerts.filter((a) => a.status === "active").length;
  const resolved = alerts.filter((a) => a.status === "resolved").length;

  // Top 5 most recent critical/high alerts with narratives
  const topAlerts = alerts
    .filter((a) => a.severity === "Critical" || a.severity === "High")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const tableData = alerts
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30)
    .map((a) => ({
      date: new Date(a.createdAt).toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
      severity: a.severity,
      cohort: a.siteName,
      title: a.title.slice(0, 50),
      rule: a.rule.replace("RULE_", "").replace(/_/g, " "),
      status: a.status,
    }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Alert Digest" subtitle="Weekly summary of system alerts" filters={filters} />

        <KpiRow
          items={[
            { label: "Total Alerts", value: alerts.length },
            { label: "Critical", value: critical, color: "#dc2626" },
            { label: "High", value: high, color: "#f59e0b" },
            { label: "Unacknowledged", value: unacked, color: "#C42152" },
            { label: "Resolved", value: resolved, color: "#00999E" },
          ]}
        />

        {/* Critical narratives section */}
        {topAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Critical & High Priority Alerts</Text>
            {topAlerts.map((alert) => (
              <View key={alert.id} style={styles.narrativeBox}>
                <Text style={styles.narrativeTitle}>
                  [{alert.severity}] {alert.title}
                </Text>
                <Text style={styles.narrativeText}>
                  {alert.narrative || alert.description}
                </Text>
                <Text style={styles.narrativeMeta}>
                  {alert.siteName} · {new Date(alert.createdAt).toLocaleDateString("en-KE")} · {alert.status}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Alerts</Text>
          <PdfTable
            columns={[
              { key: "date", header: "Date", width: 0.8 },
              { key: "severity", header: "Severity", width: 0.8 },
              { key: "cohort", header: "Cohort", width: 1.2 },
              { key: "title", header: "Alert", width: 2 },
              { key: "rule", header: "Rule", width: 1.2 },
              { key: "status", header: "Status", width: 0.8 },
            ]}
            data={tableData}
            maxRows={30}
          />
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
