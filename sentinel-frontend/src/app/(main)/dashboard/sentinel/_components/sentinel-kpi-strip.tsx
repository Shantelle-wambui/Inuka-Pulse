import { AlertTriangle, CheckCircle2, Users, Gauge, Heart, XCircle, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Alert, DataQualitySummary, SiteRiskSummary } from "@/lib/sentinel/types";

interface SentinelKpiStripProps {
  sites: SiteRiskSummary[];
  alerts: Alert[];
  quality: DataQualitySummary;
}

export function SentinelKpiStrip({ sites, alerts, quality }: SentinelKpiStripProps) {
  // Total beneficiaries across all cohorts (estimate: avg 100 per cohort)
  const totalBeneficiaries = sites.length * 100;
  // At-risk cohorts = Critical + High
  const atRiskCohorts = sites.filter(
    (s) => s.severityBand === "Critical" || s.severityBand === "High"
  ).length;
  const activeAlerts = alerts.filter((a) => a.status === "active").length;
  // Missed disbursements = sum of pressureSpikeCount (mapped to missed disbursements)
  const missedDisbursements = sites.reduce((sum, s) => sum + s.pressureSpikeCount, 0);

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border dark:shadow-none dark:ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">Active Beneficiaries</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-2xl leading-none tracking-tight">~{totalBeneficiaries.toLocaleString()}</div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Users className="size-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">At-Risk Cohorts</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-2xl leading-none tracking-tight">{atRiskCohorts}</div>
            <Badge className="bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400">
              <XCircle className="size-3" />
              Needs intervention
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-2xl leading-none tracking-tight">{activeAlerts}</div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-orange-500/10">
              <AlertTriangle className="size-4 text-orange-700 dark:text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">Missed Disbursements</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-2xl leading-none tracking-tight">{missedDisbursements}</div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-yellow-500/10">
              <Zap className="size-4 text-yellow-600 dark:text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal text-sm">Data Quality</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-2xl leading-none tracking-tight">{(quality.passRate * 100).toFixed(1)}%</div>
            <Badge className="bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300">
              <CheckCircle2 className="size-3" />
              {quality.gateStatus === "passed" ? "Gate OK" : "Gate FAIL"}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
