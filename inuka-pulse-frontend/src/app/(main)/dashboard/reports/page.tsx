"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Table2,
  AlertTriangle,
  Shield,
  TrendingUp,
  Heart,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ReportGenerator } from "./_components/report-generator";
import { CohortPerformanceReport, type CohortPerformanceData } from "./templates/cohort-performance";
import { AlertDigestReport, type AlertDigestData } from "./templates/alert-digest";
import { DataQualityReport, type DataQualityData } from "./templates/data-quality";
import { ProgrammeImpactReport, type ProgrammeImpactData } from "./templates/programme-impact";
import { DonorImpactReport, type DonorImpactData } from "./templates/donor-impact";
import { BeneficiaryRiskRegisterReport, type BeneficiaryRiskRegisterData } from "./templates/beneficiary-risk-register";

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
const getToken = () => document.cookie.match(/inuka-token=([^;]+)/)?.[1];

function authedHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: authedHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── CSV Export Helper ──────────────────────────────────────────────────────

function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) {
    toast.error("No data to export.");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = String(row[h] ?? "");
        return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`CSV exported: ${filename}`);
}

// ─── Report Definitions ─────────────────────────────────────────────────────

type ReportCategory = "M&E" | "Operations" | "Donor" | "Analytics";

interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  icon: typeof FileText;
  fetchData: () => Promise<unknown>;
  renderDocument: (data: unknown) => React.ReactElement;
  csvExport?: (data: unknown) => Record<string, unknown>[];
}

const REPORTS: ReportDefinition[] = [
  {
    id: "cohort-performance",
    title: "Cohort Performance Report",
    description: "Per-cohort vulnerability scores, risk bands, field visit recency, and at-risk beneficiary counts.",
    category: "M&E",
    icon: TrendingUp,
    fetchData: async () => {
      const cohorts = await fetchJson(`${API_BASE}/api/sites/risk-summary`);
      return { cohorts } as CohortPerformanceData;
    },
    renderDocument: (data) => <CohortPerformanceReport data={data as CohortPerformanceData} />,
    csvExport: (data) => (data as CohortPerformanceData).cohorts.map((c) => ({
      Site_ID: c.siteId,
      Cohort: c.siteName,
      Risk_Score: c.riskScore,
      Severity_Band: c.severityBand,
      At_Risk_Count: c.incidentCount,
      Missed_Disbursements: c.pressureSpikeCount,
      Days_Since_Visit: c.daysSinceLastAudit,
      Rejected_Rate: (c.rejectedRate * 100).toFixed(1) + "%",
    })),
  },
  {
    id: "alert-digest",
    title: "Alert Digest",
    description: "Weekly summary of system alerts — critical narratives, severity breakdown, and resolution status.",
    category: "Operations",
    icon: AlertTriangle,
    fetchData: async () => {
      const alerts = await fetchJson(`${API_BASE}/api/alerts`);
      return { alerts } as AlertDigestData;
    },
    renderDocument: (data) => <AlertDigestReport data={data as AlertDigestData} />,
    csvExport: (data) => (data as AlertDigestData).alerts.map((a) => ({
      Date: new Date(a.createdAt).toLocaleDateString(),
      Severity: a.severity,
      Cohort: a.siteName,
      Title: a.title,
      Rule: a.rule,
      Status: a.status,
    })),
  },
  {
    id: "data-quality",
    title: "Data Quality Report",
    description: "ETL pipeline health — batch pass/fail rates, rejection trends, and quality gate status.",
    category: "Analytics",
    icon: Shield,
    fetchData: async () => {
      const [summary, batches] = await Promise.all([
        fetchJson(`${API_BASE}/api/quality/summary`),
        fetchJson(`${API_BASE}/api/quality/batches`),
      ]);
      return { summary, batches } as DataQualityData;
    },
    renderDocument: (data) => <DataQualityReport data={data as DataQualityData} />,
    csvExport: (data) => (data as DataQualityData).batches.map((b) => ({
      Batch_ID: b.batchId,
      Source_File: b.sourceFilename,
      Rows: b.rowCount,
      Trusted: b.trustedCount,
      Corrected: b.correctedCount,
      Review: b.reviewCount,
      Rejected: b.rejectedCount,
      Ingested_At: b.ingestedAt,
    })),
  },
  {
    id: "programme-impact",
    title: "Programme Impact Report",
    description: "Beneficiary reach, completion rates, employment outcomes, and cost metrics across all pillars.",
    category: "M&E",
    icon: Heart,
    fetchData: async () => {
      const [impact, byPillar, byCounty] = await Promise.all([
        fetchJson(`${API_BASE}/api/v1/analytics/impact`),
        fetchJson(`${API_BASE}/api/v1/analytics/impact/by-pillar`),
        fetchJson(`${API_BASE}/api/v1/analytics/impact/county-reach`),
      ]);
      return {
        summary: impact,
        byPillar,
        byCounty,
      } as ProgrammeImpactData;
    },
    renderDocument: (data) => <ProgrammeImpactReport data={data as ProgrammeImpactData} />,
    csvExport: (data) => (data as ProgrammeImpactData).byPillar.map((p) => ({
      Pillar: p.pillar,
      Beneficiaries: p.beneficiaries,
      Completion_Rate: (p.completionRate * 100).toFixed(1) + "%",
      Employment_Rate: (p.employmentRate * 100).toFixed(1) + "%",
    })),
  },
  {
    id: "donor-impact",
    title: "Donor Impact Report",
    description: "Fund utilization, programmes supported, beneficiaries reached — prepared for external donors.",
    category: "Donor",
    icon: Users,
    fetchData: async () => {
      const [donors, funding, trends] = await Promise.all([
        fetchJson(`${API_BASE}/api/v1/donors`),
        fetchJson(`${API_BASE}/api/v1/donors/funding`),
        fetchJson(`${API_BASE}/api/v1/donors/trends`),
      ]);
      // Aggregate across all donors for summary report
      const totalCommitted = funding.reduce((s: number, f: any) => s + (f.committed || 0), 0);
      const totalDisbursed = funding.reduce((s: number, f: any) => s + (f.disbursed || 0), 0);
      return {
        donorName: "All Donors (Aggregated)",
        totalCommitted,
        totalDisbursed,
        programsFunded: funding.length,
        beneficiariesReached: funding.reduce((s: number, f: any) => s + (f.beneficiaries || 0), 0),
        programs: funding.map((f: any) => ({
          name: f.programName || f.name || "Programme",
          pillar: f.pillar || "—",
          county: f.county || "—",
          committed: f.committed || 0,
          disbursed: f.disbursed || 0,
          utilization: f.committed > 0 ? f.disbursed / f.committed : 0,
          beneficiaries: f.beneficiaries || 0,
          status: f.status || "active",
        })),
        trends,
      } as DonorImpactData;
    },
    renderDocument: (data) => <DonorImpactReport data={data as DonorImpactData} />,
    csvExport: (data) => (data as DonorImpactData).programs.map((p) => ({
      Programme: p.name,
      Pillar: p.pillar,
      County: p.county,
      Committed: p.committed,
      Disbursed: p.disbursed,
      Utilization: (p.utilization * 100).toFixed(1) + "%",
      Beneficiaries: p.beneficiaries,
    })),
  },
  {
    id: "beneficiary-risk-register",
    title: "Beneficiary Risk Register",
    description: "Individual-level dropout predictions with probability scores and top risk drivers.",
    category: "M&E",
    icon: FileText,
    fetchData: async () => {
      // Try the new beneficiary predictions endpoint (Phase 2)
      // Fall back to cohort-level data if not yet available
      try {
        const [predictions, summary] = await Promise.all([
          fetchJson(`${API_BASE}/api/beneficiaries/predictions`),
          fetchJson(`${API_BASE}/api/beneficiaries/predictions/summary`),
        ]);
        return { predictions, summary } as BeneficiaryRiskRegisterData;
      } catch {
        // Fallback: use cohort-level risk data until Phase 2 is deployed
        const cohorts = await fetchJson(`${API_BASE}/api/sites/risk-summary`);
        const fallbackPredictions = cohorts.map((c: any) => ({
          beneficiaryId: c.siteId,
          cohort: c.siteName,
          county: c.siteName.split(" ")[0] || "Kenya",
          pillar: "Programme",
          dropoutProb: c.riskScore / 100,
          predictedBand: c.severityBand,
          topFeatures: `Risk Score ${c.riskScore}|${c.incidentCount} incidents|${c.daysSinceLastAudit}d since visit`,
        }));
        const summary = {
          total: cohorts.length,
          active: cohorts.filter((c: any) => c.severityBand === "Low").length,
          atRisk: cohorts.filter((c: any) => c.severityBand === "Medium").length,
          disengaged: cohorts.filter((c: any) => c.severityBand === "High").length,
          dropout: cohorts.filter((c: any) => c.severityBand === "Critical").length,
        };
        return { predictions: fallbackPredictions, summary } as BeneficiaryRiskRegisterData;
      }
    },
    renderDocument: (data) => <BeneficiaryRiskRegisterReport data={data as BeneficiaryRiskRegisterData} />,
    csvExport: (data) => (data as BeneficiaryRiskRegisterData).predictions.map((p) => ({
      Beneficiary_ID: p.beneficiaryId,
      Cohort: p.cohort,
      County: p.county,
      Pillar: p.pillar,
      Risk_Band: p.predictedBand,
      Dropout_Probability: (p.dropoutProb * 100).toFixed(1) + "%",
      Top_Risk_Factors: p.topFeatures.replace(/\|/g, "; "),
    })),
  },
];

// ─── Category colours ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<ReportCategory, string> = {
  "M&E": "bg-[#C42152]/10 text-[#C42152] border-[#C42152]/20",
  Operations: "bg-amber-50 text-amber-700 border-amber-200",
  Donor: "bg-[#00999E]/10 text-[#00999E] border-[#00999E]/20",
  Analytics: "bg-purple-50 text-purple-700 border-purple-200",
};

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [csvLoading, setCsvLoading] = useState<string | null>(null);

  const filtered = categoryFilter === "all"
    ? REPORTS
    : REPORTS.filter((r) => r.category === categoryFilter);

  const handleCsvExport = async (report: ReportDefinition) => {
    if (!report.csvExport) return;
    setCsvLoading(report.id);
    try {
      const data = await report.fetchData();
      const rows = report.csvExport(data);
      exportCSV(rows, report.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`CSV export failed: ${msg}`);
    } finally {
      setCsvLoading(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download programme reports as PDF or CSV
          </p>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="M&E">M&E</SelectItem>
            <SelectItem value="Operations">Operations</SelectItem>
            <SelectItem value="Donor">Donor</SelectItem>
            <SelectItem value="Analytics">Analytics</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Report cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-2">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-sm leading-tight">{report.title}</CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[report.category]}
                  >
                    {report.category}
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-2">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <div className="flex gap-2">
                  <ReportGenerator
                    reportId={report.id}
                    title={report.title}
                    fetchData={report.fetchData}
                    renderDocument={report.renderDocument}
                  />
                  {report.csvExport && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-shrink-0"
                      disabled={csvLoading === report.id}
                      onClick={() => handleCsvExport(report)}
                    >
                      <Table2 className="size-4 mr-1" />
                      CSV
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
