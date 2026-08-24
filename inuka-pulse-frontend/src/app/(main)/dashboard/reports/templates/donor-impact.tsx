import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "./shared/report-header";
import { ReportFooter } from "./shared/report-footer";
import { KpiRow } from "./shared/kpi-row";
import { PdfTable } from "./shared/pdf-table";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, fontFamily: "Helvetica" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1a1a1a", marginBottom: 8 },
  progressContainer: { marginVertical: 8 },
  progressLabel: { fontSize: 8, color: "#666", marginBottom: 3 },
  progressBar: { height: 12, backgroundColor: "#f3f3f3", borderRadius: 6, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#00999E", borderRadius: 6 },
  progressText: { fontSize: 8, color: "#333", marginTop: 2, textAlign: "right" },
});

interface FundingProgram {
  name: string;
  pillar: string;
  county: string;
  committed: number;
  disbursed: number;
  utilization: number;
  beneficiaries: number;
  status: string;
}

interface DonorTrend {
  month: string;
  committed: number;
  disbursed: number;
}

export interface DonorImpactData {
  donorName: string;
  totalCommitted: number;
  totalDisbursed: number;
  programsFunded: number;
  beneficiariesReached: number;
  programs: FundingProgram[];
  trends: DonorTrend[];
  filters?: Record<string, string | undefined>;
}

export function DonorImpactReport({ data }: { data: DonorImpactData }) {
  const { donorName, totalCommitted, totalDisbursed, programsFunded, beneficiariesReached, programs, filters } = data;

  const utilization = totalCommitted > 0 ? (totalDisbursed / totalCommitted) * 100 : 0;
  const formatKES = (n: number) => `KES ${(n / 1_000_000).toFixed(1)}M`;

  const tableData = programs
    .sort((a, b) => b.committed - a.committed)
    .map((p) => ({
      program: p.name.slice(0, 30),
      pillar: p.pillar,
      county: p.county,
      committed: formatKES(p.committed),
      disbursed: formatKES(p.disbursed),
      utilization: `${(p.utilization * 100).toFixed(0)}%`,
      beneficiaries: p.beneficiaries.toLocaleString(),
      status: p.status,
    }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader
          title="Donor Impact Report"
          subtitle={`Prepared for: ${donorName}`}
          filters={filters}
        />

        <KpiRow
          items={[
            { label: "Total Committed", value: formatKES(totalCommitted), color: "#00999E" },
            { label: "Total Disbursed", value: formatKES(totalDisbursed) },
            { label: "Programs Funded", value: programsFunded },
            { label: "Beneficiaries Reached", value: beneficiariesReached.toLocaleString(), color: "#C42152" },
          ]}
        />

        {/* Utilization progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Overall Fund Utilization</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(utilization, 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {utilization.toFixed(1)}% disbursed ({formatKES(totalDisbursed)} of {formatKES(totalCommitted)})
          </Text>
        </View>

        {/* Funded programmes table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Funded Programmes</Text>
          <PdfTable
            columns={[
              { key: "program", header: "Programme", width: 2 },
              { key: "pillar", header: "Pillar", width: 1 },
              { key: "county", header: "County", width: 1 },
              { key: "committed", header: "Committed", width: 1, align: "right" },
              { key: "disbursed", header: "Disbursed", width: 1, align: "right" },
              { key: "utilization", header: "Used", width: 0.6, align: "center" },
              { key: "beneficiaries", header: "Beneficiaries", width: 1, align: "center" },
            ]}
            data={tableData}
          />
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
