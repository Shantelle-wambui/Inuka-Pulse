import Link from "next/link";
import { Activity, TrendingDown, Users, BarChart2 } from "lucide-react";

import { BackendError } from "@/components/backend-error";
import { EngagementBadge } from "@/components/engagement-badge";
import { RiskBandBadge } from "@/components/risk-band-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchEngagementTrends } from "@/lib/inuka-pulse/api";

import { DistributionChart, TimeSeriesChart, PillarChart } from "./charts";

/**
 * Engagement Trends — /dashboard/analytics/engagement-trends
 *
 * Server Component: fetches engagement trend data and renders KPIs,
 * distribution charts, time-series, pillar breakdown, and drifting table.
 */
export default async function EngagementTrendsPage() {
  try {
    const data = await fetchEngagementTrends();

    const driftingCount = data.driftingBeneficiaries.filter(
      (b) => b.currentScore < 40 || b.scoreDelta < -10,
    ).length;

    return (
      <div className="flex flex-col gap-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="size-7 text-primary" />
            Engagement Trends
          </h1>
          <p className="text-muted-foreground text-sm">
            Track beneficiary engagement scores over time, identify drifting
            individuals, and compare pillar performance across Inuka cohorts.
          </p>
        </div>

        {/* ── KPI Strip ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="size-4 text-blue-500" />
                Overall Avg Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">
                {data.overallAvg.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Across all scored beneficiaries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="size-4 text-green-500" />
                Total Scored
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">
                {data.totalScored.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Beneficiaries with engagement scores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="size-4 text-red-500" />
                Low / Drifting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {driftingCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Beneficiaries with low or declining scores
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Score Distribution Chart ───────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="size-4" />
                  Score Distribution
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Number of beneficiaries in each engagement score range
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.totalScored.toLocaleString()} scored
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <DistributionChart data={data.distribution} />
          </CardContent>
        </Card>

        {/* ── Time Series + Pillar Breakdown ─────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="size-4" />
                Engagement Over Time
              </CardTitle>
              <CardDescription className="text-xs">
                Average engagement score trend across all beneficiaries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart data={data.timeSeries} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="size-4" />
                Average by Pillar
              </CardTitle>
              <CardDescription className="text-xs">
                Engagement score comparison across Inuka programme pillars
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PillarChart data={data.byPillar} />
            </CardContent>
          </Card>
        </div>

        {/* ── Drifting Beneficiaries Table ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="size-4" />
                  Drifting Beneficiaries
                </CardTitle>
                <CardDescription className="text-xs">
                  Beneficiaries with declining engagement who may need intervention
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.driftingBeneficiaries.length} flagged
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {data.driftingBeneficiaries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Beneficiary</th>
                      <th className="pb-2 pr-4 font-medium">Pillar</th>
                      <th className="pb-2 pr-4 font-medium">County</th>
                      <th className="pb-2 pr-4 font-medium text-right">Score</th>
                      <th className="pb-2 pr-4 font-medium text-right">Delta</th>
                      <th className="pb-2 font-medium">Risk Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.driftingBeneficiaries.map((b) => (
                      <tr
                        key={b.beneficiaryId}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2.5 pr-4">
                          <Link
                            href={`/dashboard/case-manager/beneficiary/${b.beneficiaryId}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {b.beneficiaryId}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {b.pillar ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {b.county ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <EngagementBadge score={b.currentScore} compact />
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <span
                            className={
                              b.scoreDelta < 0
                                ? "text-red-600 dark:text-red-400 font-medium tabular-nums"
                                : "text-green-600 dark:text-green-400 font-medium tabular-nums"
                            }
                          >
                            {b.scoreDelta > 0 ? "+" : ""}
                            {b.scoreDelta.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <RiskBandBadge band={b.predictedBand} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No drifting beneficiaries detected
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch (err) {
    return (
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="size-7 text-primary" />
            Engagement Trends
          </h1>
          <p className="text-muted-foreground text-sm">
            Track beneficiary engagement scores over time, identify drifting
            individuals, and compare pillar performance across Inuka cohorts.
          </p>
        </div>
        <BackendError
          message={
            err instanceof Error
              ? err.message
              : "Failed to load engagement trends data"
          }
        />
      </div>
    );
  }
}
