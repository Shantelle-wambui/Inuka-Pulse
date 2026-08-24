import { GitBranch, Target, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackendError } from "@/components/backend-error";
import { JourneyCharts } from "./_components/journey-charts";

/**
 * Cohort Journey & Completion — /dashboard/analytics/cohort-journey
 *
 * Server Component: generates mock cohort journey data and renders KPI cards,
 * then passes data to client component for interactive Recharts visualizations.
 */
export default async function CohortJourneyPage() {
  try {
    // Mock data — replace with API call when backend endpoint is available
    const journeyData = {
      funnel: [
        { stage: "Intake", count: 850, percent: 100 },
        { stage: "Active", count: 700, percent: 82 },
        { stage: "Completing", count: 495, percent: 58 },
        { stage: "Graduated", count: 385, percent: 45 },
      ],
      dropoutByPhase: [
        { phase: "Intake → Active", dropoutRate: 18 },
        { phase: "Active → Completing", dropoutRate: 29 },
        { phase: "Completing → Graduated", dropoutRate: 22 },
      ],
      byPillar: [
        { pillar: "Scholarship", completionRate: 52 },
        { pillar: "Plus", completionRate: 41 },
        { pillar: "Vocational", completionRate: 48 },
        { pillar: "Tech", completionRate: 55 },
      ],
      milestones: [
        { name: "Sessions Milestone (80% attendance)", achieved: 68 },
        { name: "Assessment Gate (pass score)", achieved: 55 },
        { name: "Attendance Streak (30 days)", achieved: 42 },
        { name: "Graduation Requirements", achieved: 45 },
      ],
      kpis: {
        completionRate: 45,
        avgTimeMonths: 8.5,
        highRiskPhase: "Active → Completing",
        totalActive: 700,
      },
    };

    const kpis = [
      {
        label: "Overall Completion Rate",
        value: `${journeyData.kpis.completionRate}%`,
        icon: Target,
        iconColor: "text-green-500",
        description: "Beneficiaries who reached graduation",
      },
      {
        label: "Avg Time to Complete",
        value: `${journeyData.kpis.avgTimeMonths} mo`,
        icon: Clock,
        iconColor: "text-blue-500",
        description: "Average months from intake to graduation",
      },
      {
        label: "High-Risk Phase",
        value: journeyData.kpis.highRiskPhase,
        icon: GitBranch,
        iconColor: "text-red-500",
        description: "Phase with highest dropout rate",
      },
      {
        label: "Total Currently Active",
        value: journeyData.kpis.totalActive.toLocaleString(),
        icon: Users,
        iconColor: "text-purple-500",
        description: "Beneficiaries in programme now",
      },
    ];

    return (
      <div className="flex flex-col gap-6">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <GitBranch className="size-7 text-primary" />
            Cohort Journey &amp; Completion
          </h1>
          <p className="text-muted-foreground text-sm">
            Track the beneficiary lifecycle from intake to graduation. Identify
            high-attrition phases, compare completion rates across pillars, and
            monitor milestone achievement to improve programme retention.
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

        {/* ── Interactive Charts (Client Component) ───────────────────────────── */}
        <JourneyCharts
          funnel={journeyData.funnel}
          dropoutByPhase={journeyData.dropoutByPhase}
          byPillar={journeyData.byPillar}
          milestones={journeyData.milestones}
        />
      </div>
    );
  } catch (error) {
    return (
      <BackendError
        message={
          error instanceof Error
            ? error.message
            : "Failed to load cohort journey data. Please check the backend connection."
        }
        kind="connection"
      />
    );
  }
}
