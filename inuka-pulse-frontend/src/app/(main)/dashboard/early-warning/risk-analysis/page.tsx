import { Gauge, FlaskConical } from "lucide-react";

import { fetchRiskSummary } from "@/lib/inuka-pulse/api";
import { BackendError } from "@/components/backend-error";
import { RiskAnalysisView } from "./_components/risk-analysis-view";

export const metadata = {
  title: "Risk Analysis — Inuka Pulse",
  description: "What-if risk simulation for programme cohorts",
};

export default async function RiskAnalysisPage() {
  let sites;
  try {
    sites = (await fetchRiskSummary()).data;
  } catch (error) {
    return <BackendError message="Failed to load data" />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <FlaskConical className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Risk Analysis
            <Gauge className="h-5 w-5 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground">
            Test what-if scenarios to understand how changes in incident rates, audit frequency, and other factors affect cohort risk scores.
          </p>
        </div>
      </div>

      {/* Interactive risk analysis */}
      <RiskAnalysisView sites={sites} />
    </div>
  );
}
