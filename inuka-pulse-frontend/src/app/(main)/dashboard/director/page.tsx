import { LayoutDashboard, Users, TrendingDown, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  fetchBeneficiarySummary,
  fetchBreakdownByCounty,
  fetchBreakdownByPillar,
  type BeneficiarySummary,
} from "@/lib/inuka-pulse/api";
import { RiskGroupedBarChart, RiskDonutChart } from "@/components/risk-distribution-chart";

/**
 * Programme Director Dashboard — /dashboard/director
 *
 * Server Component: fetches KPI summary, county breakdown, and pillar
 * breakdown in parallel from the Spring Boot API, then renders the page.
 *
 * If the backend is unreachable or the ETL has not seeded data yet,
 * graceful fallbacks are shown so the page never hard-crashes.
 */
export default async function DirectorDashboardPage() {
  // ── Parallel data fetches ──────────────────────────────────────────────────
  const [summaryResult, countyResult, pillarResult] = await Promise.allSettled([
    fetchBeneficiarySummary(),
    fetchBreakdownByCounty(),
    fetchBreakdownByPillar(),
  ]);

  const summary: BeneficiarySummary | null =
    summaryResult.status === "fulfilled" ? summaryResult.value : null;

  const countyData: Record<string, Record<string, number>> =
    countyResult.status === "fulfilled" ? countyResult.value : {};

  const pillarData: Record<string, Record<string, number>> =
    pillarResult.status === "fulfilled" ? pillarResult.value : {};

  const hasData = summary !== null && summary.total > 0;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function pct(count: number, total: number): string {
    if (!total) return "0%";
    return `${Math.round((count / total) * 100)}%`;
  }

  function fmt(n: number | undefined): string {
    if (n == null) return "—";
    return n.toLocaleString();
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="size-7 text-primary" />
            Programme Overview
          </h1>
          <p className="text-muted-foreground text-sm">
            Executive view of beneficiary risk, programme health, and predicted dropout risk across all pillars and counties.
          </p>
        </div>
        {summary?.lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 shrink-0">
            <RefreshCw className="size-3" />
            Predictions as of {summary.lastUpdated}
          </div>
        )}
      </div>

      {/* ── No-data banner ──────────────────────────────────────────────────── */}
      {!hasData && (
        <Card className="border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4 text-sm text-amber-800 dark:text-amber-300">
            No beneficiary predictions loaded yet. Run the ML pipeline
            (<code className="font-mono text-xs">python -m src.predict</code>) and restart the
            backend to populate the dashboard.
          </CardContent>
        </Card>
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {/* Total */}
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="size-4" />
              Total Beneficiaries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{fmt(summary?.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">Across all pillars</p>
          </CardContent>
        </Card>

        {/* Active */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-500" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">
              {fmt(summary?.active)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasData ? pct(summary!.active, summary!.total) + " of total" : "On track"}
            </p>
          </CardContent>
        </Card>

        {/* At-Risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              At-Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {fmt(summary?.atRisk)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasData ? pct(summary!.atRisk, summary!.total) + " of total" : "Predicted risk band"}
            </p>
          </CardContent>
        </Card>

        {/* Disengaged */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="size-4 text-orange-500" />
              Disengaged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
              {fmt(summary?.disengaged)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasData ? pct(summary!.disengaged, summary!.total) + " of total" : "Low engagement"}
            </p>
          </CardContent>
        </Card>

        {/* Predicted Dropout */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="size-4 text-red-500" />
              Predicted Dropout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {fmt(summary?.dropout)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasData ? pct(summary!.dropout, summary!.total) + " of total" : "High dropout probability"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Risk distribution row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Overall doughnut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Risk Distribution</CardTitle>
            <CardDescription className="text-xs">
              Predicted risk bands across all {fmt(summary?.total)} beneficiaries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <RiskDonutChart
                active={summary!.active}
                atRisk={summary!.atRisk}
                disengaged={summary!.disengaged}
                dropout={summary!.dropout}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No data — run the prediction pipeline
              </div>
            )}
          </CardContent>
        </Card>

        {/* County breakdown */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Risk by County</CardTitle>
            <CardDescription className="text-xs">
              Beneficiary risk distribution per county — stacked by predicted band
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(countyData).length > 0 ? (
              <RiskGroupedBarChart data={countyData} categoryLabel="County" height={260} />
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No county data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Pillar breakdown ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk by Programme Pillar</CardTitle>
          <CardDescription className="text-xs">
            Dropout risk distribution per programme pillar (Scholarship, Plus, Vocational, Tech)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(pillarData).length > 0 ? (
            <RiskGroupedBarChart data={pillarData} categoryLabel="Pillar" height={220} />
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No pillar data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Available filters info ──────────────────────────────────────────── */}
      {hasData && (summary!.counties.length > 0 || summary!.pillars.length > 0) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {summary!.counties.length > 0 && (
            <span>
              <strong>Counties:</strong> {summary!.counties.join(", ")}
            </span>
          )}
          {summary!.pillars.length > 0 && (
            <span>
              <strong>Pillars:</strong> {summary!.pillars.join(", ")}
            </span>
          )}
        </div>
      )}

      {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground/60 border-t pt-3">
        Predictions are generated by a logistic regression model and reflect predicted risk, not confirmed outcomes.
        Use this data to prioritise follow-up — not as a definitive classification.
      </p>
    </div>
  );
}
