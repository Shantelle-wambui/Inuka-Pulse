import { DollarSign, Clock, AlertTriangle, CalendarDays, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackendError } from "@/components/backend-error";
import { fetchDisbursementCompliance } from "@/lib/inuka-pulse/api";
import { DelayByPillarChart } from "./_components/delay-by-pillar-chart";
import { DelayByCountyChart } from "./_components/delay-by-county-chart";

/**
 * Disbursement Compliance — /dashboard/analytics/disbursement-compliance
 *
 * Server Component: fetches disbursement compliance data including payment
 * timeliness, missed disbursements, correlation with dropout risk, and
 * calendar of upcoming/overdue payments.
 */
export default async function DisbursementCompliancePage() {
  try {
    const data = await fetchDisbursementCompliance();

    const kpis = [
      {
        label: "On-Time Rate",
        value: `${(data.overallOnTimeRate * 100).toFixed(1)}%`,
        icon: DollarSign,
        iconColor: "text-green-500",
        description: "Payments disbursed on schedule",
      },
      {
        label: "Avg Delay Days",
        value: `${data.avgDelayDays.toFixed(1)}`,
        icon: Clock,
        iconColor: "text-amber-500",
        description: "Average days past due",
      },
      {
        label: "Missed (60d)",
        value: data.totalMissed60d.toLocaleString(),
        icon: AlertTriangle,
        iconColor: "text-red-500",
        description: "Overdue > 60 days",
      },
      {
        label: "Upcoming Payments",
        value: data.totalUpcoming.toLocaleString(),
        icon: CalendarDays,
        iconColor: "text-blue-500",
        description: "Scheduled in next cycle",
      },
    ];

    // Transform byPillar into chart data
    const pillarChartData = Object.entries(data.byPillar).map(([pillar, metrics]) => ({
      name: pillar,
      avgDelay: metrics.avgDelay,
      missedRate: metrics.missedRate,
    }));

    // Transform byCounty into chart data
    const countyChartData = Object.entries(data.byCounty).map(([county, metrics]) => ({
      name: county,
      avgDelay: metrics.avgDelay,
      missedRate: metrics.missedRate,
    }));

    // Determine correlation interpretation
    const r = data.correlationWithDropout;
    const corrStrength =
      Math.abs(r) >= 0.7 ? "strong" :
      Math.abs(r) >= 0.4 ? "moderate" :
      Math.abs(r) >= 0.2 ? "weak" : "negligible";
    const corrDirection = r > 0 ? "positive" : "negative";
    const corrInterpretation =
      r > 0
        ? `Longer delays are associated with higher dropout rates (${corrStrength} ${corrDirection} correlation).`
        : r < 0
          ? `On-time disbursements are associated with higher dropout rates — unusual, may need investigation (${corrStrength} ${corrDirection} correlation).`
          : "No meaningful linear relationship between delay and dropout.";

    // Status badge styles
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string; label: string }> = {
      on_time: { variant: "default", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800", label: "On Time" },
      delayed: { variant: "default", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800", label: "Delayed" },
      missed: { variant: "destructive", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800", label: "Missed" },
      upcoming: { variant: "default", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800", label: "Upcoming" },
    };

    // Sort calendar entries by date descending (most recent first), take top 20
    const calendarEntries = [...data.calendar]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    return (
      <div className="flex flex-col gap-6">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="size-7 text-primary" />
            Disbursement Compliance
          </h1>
          <p className="text-muted-foreground text-sm">
            Track payment timeliness across cohorts and pillars. Monitor on-time rates,
            identify delayed disbursements, and understand their correlation with beneficiary dropout risk.
          </p>
        </div>

        {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <kpi.icon className={`size-4 ${kpi.iconColor}`} />
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Cohort Compliance Table ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="size-4" />
              Cohort Compliance
            </CardTitle>
            <CardDescription className="text-xs">
              Disbursement performance by cohort — on-time rate, average delay, and missed payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Cohort</th>
                    <th className="pb-2 font-medium text-right">Avg Delay (days)</th>
                    <th className="pb-2 font-medium text-right">Missed</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium min-w-[180px]">On-Time Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCohort.map((cohort) => (
                    <tr key={cohort.cohortId} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{cohort.cohortName}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {cohort.avgDelayDays.toFixed(1)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        <span className={cohort.missedCount > 0 ? "text-red-600 dark:text-red-400 font-semibold" : ""}>
                          {cohort.missedCount}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{cohort.totalDisbursements}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                cohort.onTimeRate >= 0.9
                                  ? "bg-green-500"
                                  : cohort.onTimeRate >= 0.7
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${(cohort.onTimeRate * 100).toFixed(0)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums font-medium w-10 text-right">
                            {(cohort.onTimeRate * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Charts: Delay by Pillar + Delay by County ──────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="size-4" />
                Average Delay by Pillar
              </CardTitle>
              <CardDescription className="text-xs">
                Mean disbursement delay (days) per programme pillar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DelayByPillarChart data={pillarChartData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="size-4" />
                Average Delay by County
              </CardTitle>
              <CardDescription className="text-xs">
                Mean disbursement delay (days) per county.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DelayByCountyChart data={countyChartData} />
            </CardContent>
          </Card>
        </div>

        {/* ── Correlation with Dropout ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-purple-500" />
              Correlation with Dropout
            </CardTitle>
            <CardDescription className="text-xs">
              Pearson correlation between disbursement delay and beneficiary dropout rate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-4xl font-bold tabular-nums">
                  {r > 0 ? "+" : ""}{r.toFixed(3)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Pearson r</p>
              </div>
              <div className="flex-1">
                <Badge
                  variant="outline"
                  className={
                    Math.abs(r) >= 0.4
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                      : Math.abs(r) >= 0.2
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                        : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                  }
                >
                  {corrStrength} {corrDirection}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {corrInterpretation}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Disbursement Calendar ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="size-4" />
              Recent &amp; Upcoming Disbursements
            </CardTitle>
            <CardDescription className="text-xs">
              Payment schedule with status tracking — most recent first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {calendarEntries.map((entry, i) => {
                const cfg = statusConfig[entry.status];
                return (
                  <div
                    key={`${entry.cohortId}-${entry.date}-${i}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground tabular-nums w-20">
                        {new Date(entry.date).toLocaleDateString("en-KE", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{entry.cohortName}</p>
                        {entry.amount != null && (
                          <p className="text-xs text-muted-foreground">
                            KES {entry.amount.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.delayDays != null && entry.delayDays > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          +{entry.delayDays}d
                        </span>
                      )}
                      <Badge variant={cfg.variant} className={cfg.className}>
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    return (
      <BackendError
        message={
          error instanceof Error
            ? error.message
            : "Failed to load disbursement compliance data. Please check the backend connection."
        }
        kind="connection"
      />
    );
  }
}
