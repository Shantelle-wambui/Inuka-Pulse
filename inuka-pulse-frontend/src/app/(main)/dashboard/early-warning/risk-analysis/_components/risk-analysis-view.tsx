"use client";

import { useState } from "react";
import { Gauge, FlaskConical } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatIfPanel } from "@/app/(main)/dashboard/inuka/_components/what-if-panel";
import { RiskScoreBreakdown } from "@/app/(main)/dashboard/inuka/_components/risk-score-breakdown";
import type { SiteRiskSummary } from "@/lib/inuka-pulse/types";

interface RiskAnalysisViewProps {
  sites: SiteRiskSummary[];
}

export function RiskAnalysisView({ sites }: RiskAnalysisViewProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(
    sites[0]?.siteId ?? ""
  );

  const site = sites.find((s) => s.siteId === selectedSiteId);

  if (!site) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No cohort data available. Please ensure the backend is running.
        </CardContent>
      </Card>
    );
  }

  const liveCritHighCount = Math.round(
    site.incidentCount * (site.rejectedRate || 0.3)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Site/Cohort selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />
            Select Cohort
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Choose a cohort/site..." />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.siteId} value={s.siteId}>
                  {s.siteName} — Score: {s.riskScore} ({s.severityBand})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Risk Score Breakdown */}
      <RiskScoreBreakdown
        riskScore={site.riskScore}
        severityBand={site.severityBand}
        incidentCount={site.incidentCount}
        critHighCount={liveCritHighCount}
        daysSinceAudit={site.daysSinceLastAudit}
        rejectedRate={site.rejectedRate}
        pressureSpikeCount={site.pressureSpikeCount}
      />

      {/* What-If Simulation Panel */}
      <WhatIfPanel
        siteId={site.siteId}
        currentScore={site.riskScore}
        currentBand={site.severityBand}
        liveIncidentCount={site.incidentCount}
        liveCritHighCount={liveCritHighCount}
        liveDaysSinceAudit={site.daysSinceLastAudit}
        liveRejectedRate={site.rejectedRate}
        livePressureSpikes={site.pressureSpikeCount}
      />
    </div>
  );
}
