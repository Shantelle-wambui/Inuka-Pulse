import { LayoutDashboard, Users, TrendingDown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Programme Director Dashboard — /dashboard/director
 *
 * Executive overview of programme health and beneficiary risk.
 * This is a shell — real data will be wired in Phase 4 once the
 * beneficiary predictions API is built.
 */
export default function DirectorDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="size-7 text-primary" />
          Programme Overview
        </h1>
        <p className="text-muted-foreground text-sm">
          Executive view of beneficiary risk, programme health, and intervention status across all pillars and counties.
        </p>
      </div>

      {/* KPI strip — placeholder until Phase 4 wires in real data */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="size-4" />
              Total Beneficiaries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">—</p>
            <p className="text-xs text-muted-foreground mt-1">Across all pillars</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              At-Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">—</p>
            <p className="text-xs text-muted-foreground mt-1">Predicted risk band</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="size-4 text-orange-500" />
              Disengaged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-orange-600 dark:text-orange-400">—</p>
            <p className="text-xs text-muted-foreground mt-1">Low engagement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="size-4 text-red-500" />
              Predicted Dropout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">—</p>
            <p className="text-xs text-muted-foreground mt-1">High dropout probability</p>
          </CardContent>
        </Card>
      </div>

      {/* Coming soon panels */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Risk Distribution by County</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Coming in Phase 4 — county risk breakdown chart
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Risk Distribution by Pillar</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Coming in Phase 4 — pillar comparison chart
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Risk Trend Over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Coming in Phase 4 — dropout risk trend line chart
        </CardContent>
      </Card>
    </div>
  );
}
