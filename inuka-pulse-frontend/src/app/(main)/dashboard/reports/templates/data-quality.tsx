import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "./shared/report-header";
import { ReportFooter } from "./shared/report-footer";
import { KpiRow } from "./shared/kpi-row";
import { PdfTable } from "./shared/pdf-table";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, fontFamily: "Helvetica" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1a1a1a", marginBottom: 8 },
  gateStatus: {
    padding: "8px 12px",
    borderRadius: 4,
    marginVertical: 10,
    textAlign: "center",
  },
  gatePass: { backgroundColor: "#ecfdf5", border: "1px solid #00999E" },
  gateFail: { backgroundColor: "#fef2f2", border: "1px solid #C42152" },
  gateText: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  bar: { flexDirection: "row", height: 16, borderRadius: 4, overflow: "hidden", marginVertical: 8 },
  barSegment: { height: "100%" },
  legend: { flexDirection: "row", gap: 12, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 8, color: "#666" },
});

interface QualitySummary {
  trusted: number;
  corrected: number;
  review: number;
  rejected: number;
  total: number;
  passRate: number;
  gateStatus: "passed" | "failed";
  threshold: number;
}

interface BatchData {
  batchId: string;
  sourceFilename: string;
  rowCount: number;
  ingestedAt: string;
  trustedCount: number;
  correctedCount: number;
  reviewCount: number;
  rejectedCount: number;
}

export interface DataQualityData {
  summary: QualitySummary;
  batches: BatchData[];
  filters?: Record<string, string | undefined>;
}

export function DataQualityReport({ data }: { data: DataQualityData }) {
  const { summary, batches, filters } = data;

  const pct = (n: number) => summary.total > 0 ? ((n / summary.total) * 100).toFixed(1) : "0";

  const tableData = batches
    .sort((a, b) => new Date(b.ingestedAt).getTime() - new Date(a.ingestedAt).getTime())
    .slice(0, 20)
    .map((b) => ({
      date: new Date(b.ingestedAt).toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      file: b.sourceFilename.slice(0, 25),
      rows: String(b.rowCount),
      trusted: String(b.trustedCount),
      corrected: String(b.correctedCount),
      review: String(b.reviewCount),
      rejected: String(b.rejectedCount),
      passRate: b.rowCount > 0 ? `${(((b.trustedCount + b.correctedCount) / b.rowCount) * 100).toFixed(1)}%` : "—",
    }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Data Quality Report" subtitle="ETL pipeline health and data integrity" filters={filters} />

        {/* Gate Status Banner */}
        <View style={[styles.gateStatus, summary.gateStatus === "passed" ? styles.gatePass : styles.gateFail]}>
          <Text style={[styles.gateText, { color: summary.gateStatus === "passed" ? "#00999E" : "#C42152" }]}>
            Quality Gate: {summary.gateStatus.toUpperCase()} ({summary.passRate.toFixed(1)}% pass rate, threshold: {summary.threshold}%)
          </Text>
        </View>

        <KpiRow
          items={[
            { label: "Total Records", value: summary.total.toLocaleString() },
            { label: "Trusted", value: `${pct(summary.trusted)}%`, color: "#00999E" },
            { label: "Corrected", value: `${pct(summary.corrected)}%`, color: "#3b82f6" },
            { label: "In Review", value: `${pct(summary.review)}%`, color: "#f59e0b" },
            { label: "Rejected", value: `${pct(summary.rejected)}%`, color: "#C42152" },
          ]}
        />

        {/* Quality distribution bar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quality Distribution</Text>
          <View style={styles.bar}>
            {summary.trusted > 0 && <View style={[styles.barSegment, { flex: summary.trusted, backgroundColor: "#00999E" }]} />}
            {summary.corrected > 0 && <View style={[styles.barSegment, { flex: summary.corrected, backgroundColor: "#3b82f6" }]} />}
            {summary.review > 0 && <View style={[styles.barSegment, { flex: summary.review, backgroundColor: "#f59e0b" }]} />}
            {summary.rejected > 0 && <View style={[styles.barSegment, { flex: summary.rejected, backgroundColor: "#C42152" }]} />}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#00999E" }]} /><Text style={styles.legendLabel}>Trusted ({summary.trusted})</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#3b82f6" }]} /><Text style={styles.legendLabel}>Corrected ({summary.corrected})</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} /><Text style={styles.legendLabel}>Review ({summary.review})</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#C42152" }]} /><Text style={styles.legendLabel}>Rejected ({summary.rejected})</Text></View>
          </View>
        </View>

        {/* Batch history table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Batches</Text>
          <PdfTable
            columns={[
              { key: "date", header: "Ingested", width: 1.3 },
              { key: "file", header: "Source File", width: 1.5 },
              { key: "rows", header: "Rows", width: 0.6, align: "center" },
              { key: "trusted", header: "OK", width: 0.5, align: "center" },
              { key: "corrected", header: "Fixed", width: 0.5, align: "center" },
              { key: "review", header: "Review", width: 0.6, align: "center" },
              { key: "rejected", header: "Rejected", width: 0.6, align: "center" },
              { key: "passRate", header: "Pass %", width: 0.7, align: "center" },
            ]}
            data={tableData}
            maxRows={20}
          />
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
