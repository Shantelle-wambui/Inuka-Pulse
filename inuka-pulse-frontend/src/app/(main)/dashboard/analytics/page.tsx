import {
  BrainCircuit,
  BarChart2,
  FlaskConical,
  Database,
  TrendingUp,
  Target,
  Layers,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchBacktestReport, fetchFeatureImportance, fetchBeneficiarySummary } from "@/lib/inuka-pulse/api";
import { FeatureImportanceChart } from "@/components/feature-importance-chart";
import { RiskDonutChart } from "@/components/risk-distribution-chart";
import type { FeatureImportanceEntry } from "@/components/feature-importance-chart";

/**
 * Analyst Dashboard — /dashboard/analytics
 *
 * Server Component: fetches backtest metrics, feature importance, and
 * beneficiary summary in parallel. Shows the technical ML view.
 */
export default async function AnalyticsDashboardPage() {
  // ── Parallel fetches ───────────────────────────────────────────────────────
  const [backtestResult, featureResult, summaryResult] = await Promise.allSettled([
    fetchBacktestReport(),
    fetchFeatureImportance(),
    fetchBeneficiarySummary(),
  ]);

  const backtest = backtestResult.status === "fulfilled" ? backtestResult.value : null;
  const featureData = featureResult.status  === "fulfilled" ? featureResult.value  : null;
  const summary    = summaryResult.status   === "fulfilled" ? summaryResult.value   : null;

  // Feature importance: the endpoint returns an array directly
  const features: FeatureImportanceEntry[] = Array.isArray(featureData)
    ? (featureData as FeatureImportanceEntry[])
    : [];

  function fmtPct(n: number | undefined): string {
    if (n == null) return "—";
    return `${(n * 100).toFixed(1)}%`;
  }

  function fmtNum(n: number | undefined): string {
    if (n == null) return "—";
    return n.toLocaleString();
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <BrainCircuit className="size-7 text-primary" />
          ML Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          Model performance, feature importance, and beneficiary risk distribution.
          Technical view for analysts and ML administrators.
        </p>
      </div>

      {/* ── Model performance strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FlaskConical className="size-4" />
              Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold leading-tight">{String(backtest?.model ?? "Logistic Regression")}</p>
            <p className="text-xs text-muted-foreground mt-1">v1 · inuka_logreg_v1</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="size-4 text-blue-500" />
              Precision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{fmtPct(backtest?.precision)}</p>
            <p className="text-xs text-muted-foreground mt-1">Test set</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4 text-green-500" />
              Recall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{fmtPct(backtest?.recall)}</p>
            <p className="text-xs text-muted-foreground mt-1">Test set</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="size-4 text-purple-500" />
              F1 Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{fmtPct(backtest?.f1)}</p>
            <p className="text-xs text-muted-foreground mt-1">Harmonic mean</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Feature importance + prediction distribution ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Feature importance chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="size-4" />
                  Feature Importance
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Green = reduces risk when higher · Red = increases risk when higher
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">Top 10 features</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {features.length > 0 ? (
              <FeatureImportanceChart data={features} />
            ) : (
              <div className="flex items-center justify-center h-56 text-muted-foreground text-sm flex-col gap-2">
                <BarChart2 className="size-8 opacity-30" />
                <p>No feature importance data — run the prediction pipeline</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk distribution doughnut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BrainCircuit className="size-4" />
              Prediction Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              {summary ? `${fmtNum(summary.total)} beneficiaries scored` : "Beneficiary risk bands"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary && summary.total > 0 ? (
              <>
                <RiskDonutChart
                  active={summary.active}
                  atRisk={summary.atRisk}
                  disengaged={summary.disengaged}
                  dropout={summary.dropout}
                  height={200}
                />
                {/* Band breakdown table */}
                <div className="mt-3 space-y-1.5 text-sm">
                  {[
                    { label: "Active",     count: summary.active,     color: "text-green-600  dark:text-green-400" },
                    { label: "At-Risk",    count: summary.atRisk,     color: "text-amber-600  dark:text-amber-400" },
                    { label: "Disengaged", count: summary.disengaged, color: "text-orange-600 dark:text-orange-400" },
                    { label: "Dropout",    count: summary.dropout,    color: "text-red-600    dark:text-red-400" },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <span className={`font-semibold tabular-nums text-xs ${color}`}>
                        {fmtNum(count)}
                        <span className="text-muted-foreground font-normal ml-1">
                          ({Math.round((count / summary.total) * 100)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm flex-col gap-2">
                <BrainCircuit className="size-8 opacity-30" />
                <p>No predictions loaded</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Model detail cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Train / Test split */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FlaskConical className="size-4" />
              Train / Test Split
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Training rows</p>
              <p className="text-2xl font-bold tabular-nums">{fmtNum(backtest?.train_rows)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Positive rate: {fmtPct(backtest?.positive_rate_train)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Test rows</p>
              <p className="text-2xl font-bold tabular-nums">{fmtNum(backtest?.test_rows)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Positive rate: {fmtPct(backtest?.positive_rate_test)}
              </p>
            </div>
            {backtest?.split_date && (
              <div className="col-span-2 border-t pt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                Split date: <strong>{backtest.split_date}</strong>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Label definition */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="size-4" />
              Feature Dataset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Source file</p>
              <p className="font-mono text-xs mt-0.5">fact_beneficiary_features.parquet</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dataset size</p>
              <p className="font-semibold">56,498 rows · 16 columns</p>
            </div>
            {backtest?.label_definition && (
              <div>
                <p className="text-xs text-muted-foreground">Label definition</p>
                <p className="text-xs mt-0.5 leading-relaxed text-muted-foreground">
                  {String(backtest.label_definition)}
                </p>
              </div>
            )}
            {features.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Features used ({features.length})</p>
                <div className="flex flex-wrap gap-1">
                  {features.map((f) => (
                    <Badge key={f.feature} variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                      {f.feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Model notes ────────────────────────────────────────────────────── */}
      {backtest?.label_rationale && (
        <Card className="border-dashed">
          <CardContent className="pt-4 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Label rationale: </strong>
            {String(backtest.label_rationale)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
