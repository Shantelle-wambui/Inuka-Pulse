import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ReportHeader } from "./shared/report-header";
import { ReportFooter } from "./shared/report-footer";
import { KpiRow } from "./shared/kpi-row";
import { PdfTable } from "./shared/pdf-table";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, fontFamily: "Helvetica" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1a1a1a", marginBottom: 8 },
  pillarCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderBottom: "0.5px solid #eee",
  },
  pillarName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
  pillarStat: { fontSize: 9, color: "#666" },
});

interface ImpactSummary {
  totalBeneficiaries: number;
  completionRate: number;
  employmentRate: number;
  retentionRate90d: number;
  costPerBeneficiary: number;
  costPerOutcome: number;
}

interface PillarData {
  pillar: string;
  beneficiaries: number;
  completionRate: number;
  employmentRate: number;
}

interface CountyData {
  county: string;
  beneficiaries: number;
  programmes: number;
  growthPercent: number;
}

export interface ProgrammeImpactData {
  summary: ImpactSummary;
  byPillar: PillarData[];
  byCounty: CountyData[];
  filters?: Record<string, string | undefined>;
}

export function ProgrammeImpactReport({ data }: { data: ProgrammeImpactData }) {
  const { summary, byPillar, byCounty, filters } = data;

  const countyTable = byCounty
    .sort((a, b) => b.beneficiaries - a.beneficiaries)
    .map((c) => ({
      county: c.county,
      beneficiaries: c.beneficiaries.toLocaleString(),
      programmes: String(c.programmes),
      growth: `${c.growthPercent > 0 ? "+" : ""}${c.growthPercent.toFixed(1)}%`,
    }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Programme Impact Report" subtitle="Outcomes and reach across all pillars" filters={filters} />

        <KpiRow
          items={[
            { label: "Total Beneficiaries", value: summary.totalBeneficiaries.toLocaleString(), color: "#00999E" },
            { label: "Completion Rate", value: `${(summary.completionRate * 100).toFixed(1)}%` },
            { label: "Employment Rate", value: `${(summary.employmentRate * 100).toFixed(1)}%`, color: "#00999E" },
            { label: "90-Day Retention", value: `${(summary.retentionRate90d * 100).toFixed(1)}%` },
          ]}
        />

        <KpiRow
          items={[
            { label: "Cost per Beneficiary", value: `KES ${summary.costPerBeneficiary.toLocaleString()}` },
            { label: "Cost per Outcome", value: `KES ${summary.costPerOutcome.toLocaleString()}`, color: "#C42152" },
          ]}
        />

        {/* By Pillar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance by Pillar</Text>
          <PdfTable
            columns={[
              { key: "pillar", header: "Pillar", width: 1.5 },
              { key: "beneficiaries", header: "Beneficiaries", width: 1, align: "center" },
              { key: "completion", header: "Completion", width: 1, align: "center" },
              { key: "employment", header: "Employment", width: 1, align: "center" },
            ]}
            data={byPillar.map((p) => ({
              pillar: p.pillar,
              beneficiaries: p.beneficiaries.toLocaleString(),
              completion: `${(p.completionRate * 100).toFixed(1)}%`,
              employment: `${(p.employmentRate * 100).toFixed(1)}%`,
            }))}
          />
        </View>

        {/* By County */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Geographic Reach</Text>
          <PdfTable
            columns={[
              { key: "county", header: "County", width: 1.5 },
              { key: "beneficiaries", header: "Beneficiaries", width: 1, align: "center" },
              { key: "programmes", header: "Programmes", width: 1, align: "center" },
              { key: "growth", header: "Growth", width: 0.8, align: "center" },
            ]}
            data={countyTable}
          />
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
