import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "./shared/report-header";
import { ReportFooter } from "./shared/report-footer";
import { KpiRow } from "./shared/kpi-row";
import { PdfTable } from "./shared/pdf-table";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, fontFamily: "Helvetica" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1a1a1a", marginBottom: 8 },
  note: { fontSize: 8, color: "#666", marginTop: 8, fontStyle: "italic" },
  riskDistribution: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 10,
  },
  riskBand: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 4,
    alignItems: "center",
  },
  riskCount: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  riskLabel: { fontSize: 7, marginTop: 2 },
});

interface BeneficiaryPrediction {
  beneficiaryId: string;
  cohort: string;
  county: string;
  pillar: string;
  dropoutProb: number;
  predictedBand: string;
  topFeatures: string;
}

interface RiskSummary {
  total: number;
  active: number;
  atRisk: number;
  disengaged: number;
  dropout: number;
}

export interface BeneficiaryRiskRegisterData {
  predictions: BeneficiaryPrediction[];
  summary: RiskSummary;
  filters?: Record<string, string | undefined>;
}

export function BeneficiaryRiskRegisterReport({ data }: { data: BeneficiaryRiskRegisterData }) {
  const { predictions, summary, filters } = data;

  const tableData = predictions
    .sort((a, b) => b.dropoutProb - a.dropoutProb)
    .slice(0, 50)
    .map((p) => ({
      id: p.beneficiaryId.slice(0, 12),
      cohort: p.cohort,
      county: p.county,
      pillar: p.pillar,
      band: p.predictedBand,
      probability: `${(p.dropoutProb * 100).toFixed(1)}%`,
      riskFactors: p.topFeatures.replace(/\|/g, ", ").slice(0, 40),
    }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader
          title="Beneficiary Risk Register"
          subtitle="Individual-level dropout predictions and risk drivers"
          filters={filters}
        />

        <KpiRow
          items={[
            { label: "Total Beneficiaries", value: summary.total.toLocaleString(), color: "#00999E" },
            { label: "Active", value: summary.active.toLocaleString(), color: "#22c55e" },
            { label: "At-Risk", value: summary.atRisk.toLocaleString(), color: "#f59e0b" },
            { label: "Disengaged", value: summary.disengaged.toLocaleString(), color: "#C42152" },
            { label: "Dropout", value: summary.dropout.toLocaleString(), color: "#991b1b" },
          ]}
        />

        {/* Risk distribution visual */}
        <View style={styles.riskDistribution}>
          <View style={[styles.riskBand, { backgroundColor: "#ecfdf5" }]}>
            <Text style={[styles.riskCount, { color: "#22c55e" }]}>{summary.active}</Text>
            <Text style={[styles.riskLabel, { color: "#22c55e" }]}>Active</Text>
          </View>
          <View style={[styles.riskBand, { backgroundColor: "#fffbeb" }]}>
            <Text style={[styles.riskCount, { color: "#f59e0b" }]}>{summary.atRisk}</Text>
            <Text style={[styles.riskLabel, { color: "#f59e0b" }]}>At-Risk</Text>
          </View>
          <View style={[styles.riskBand, { backgroundColor: "#fef2f2" }]}>
            <Text style={[styles.riskCount, { color: "#C42152" }]}>{summary.disengaged}</Text>
            <Text style={[styles.riskLabel, { color: "#C42152" }]}>Disengaged</Text>
          </View>
          <View style={[styles.riskBand, { backgroundColor: "#fef2f2" }]}>
            <Text style={[styles.riskCount, { color: "#991b1b" }]}>{summary.dropout}</Text>
            <Text style={[styles.riskLabel, { color: "#991b1b" }]}>Dropout</Text>
          </View>
        </View>

        {/* Beneficiary table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Highest Risk Beneficiaries</Text>
          <PdfTable
            columns={[
              { key: "id", header: "ID", width: 1 },
              { key: "cohort", header: "Cohort", width: 1.2 },
              { key: "county", header: "County", width: 1 },
              { key: "pillar", header: "Pillar", width: 0.8 },
              { key: "band", header: "Band", width: 0.8 },
              { key: "probability", header: "Prob.", width: 0.6, align: "center" },
              { key: "riskFactors", header: "Top Risk Factors", width: 2.5 },
            ]}
            data={tableData}
            maxRows={50}
          />
        </View>

        <Text style={styles.note}>
          Note: This report requires the beneficiary predictions API (Phase 2). If data is unavailable,
          the report will show cohort-level risk summaries as a fallback.
        </Text>

        <ReportFooter />
      </Page>
    </Document>
  );
}
