import { Trophy, MapPin, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BackendError } from "@/components/backend-error";
import { BenchmarkingCharts } from "./_components/benchmarking-charts";

/**
 * Pillar & Location Benchmarking — /dashboard/analytics/benchmarking
 *
 * Server Component: compares programme performance across the 4 pillars
 * (Scholarship, Plus, Vocational, Tech) and 3 counties (Mombasa, Nairobi, Kisumu).
 * Uses mock data until dedicated backend endpoint is available.
 */

const benchmarkData = {
  radarDimensions: ['Attendance', 'Engagement', 'Completion', 'Disbursement', 'Assessment'],
  radarData: [
    { dimension: 'Attendance', Scholarship: 78, Plus: 65, Vocational: 72, Tech: 81 },
    { dimension: 'Engagement', Scholarship: 72, Plus: 58, Vocational: 68, Tech: 75 },
    { dimension: 'Completion', Scholarship: 52, Plus: 41, Vocational: 48, Tech: 55 },
    { dimension: 'Disbursement', Scholarship: 85, Plus: 70, Vocational: 78, Tech: 82 },
    { dimension: 'Assessment', Scholarship: 68, Plus: 55, Vocational: 62, Tech: 71 },
  ],
  countyRanking: [
    { county: 'Nairobi', active: 380, atRiskPct: 22, avgEngagement: 68, completionRate: 51, performanceIndex: 74 },
    { county: 'Mombasa', active: 295, atRiskPct: 28, avgEngagement: 62, completionRate: 44, performanceIndex: 65 },
    { county: 'Kisumu', active: 245, atRiskPct: 31, avgEngagement: 58, completionRate: 39, performanceIndex: 58 },
  ],
  heatmap: [
    { pillar: 'Scholarship', Mombasa: 68, Nairobi: 75, Kisumu: 62 },
    { pillar: 'Plus', Mombasa: 55, Nairobi: 63, Kisumu: 48 },
    { pillar: 'Vocational', Mombasa: 62, Nairobi: 70, Kisumu: 55 },
    { pillar: 'Tech', Mombasa: 70, Nairobi: 78, Kisumu: 65 },
  ],
  kpis: {
    bestPillar: 'Tech',
    bestCounty: 'Nairobi',
    biggestImprovement: 'Vocational (+8%)',
    needsAttention: 'Plus in Kisumu',
  },
};

export default async function BenchmarkingPage() {
  try {
    const data = benchmarkData;

    const kpis = [
      {
        label: "Best Performing Pillar",
        value: data.kpis.bestPillar,
        icon: Trophy,
        iconColor: "text-amber-500",
        description: "Highest composite score across all dimensions",
      },
      {
        label: "Best Performing County",
        value: data.kpis.bestCounty,
        icon: MapPin,
        iconColor: "text-green-500",
        description: "Top performance index among counties",
      },
      {
        label: "Biggest Improvement",
        value: data.kpis.biggestImprovement,
        icon: TrendingUp,
        iconColor: "text-blue-500",
        description: "Greatest gain from previous reporting period",
      },
      {
        label: "Needs Attention",
        value: data.kpis.needsAttention,
        icon: AlertTriangle,
        iconColor: "text-red-500",
        description: "Lowest performance index — intervention recommended",
      },
    ];

    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Pillar &amp; Location Benchmarking
          </h1>
          <p className="text-muted-foreground mt-1">
            Compare programme performance across all four pillars and county locations to identify
            strengths, gaps, and areas needing intervention.
          </p>
        </div>

        {/* KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts — Client Component */}
        <BenchmarkingCharts
          radarData={data.radarData}
          countyRanking={data.countyRanking}
          heatmap={data.heatmap}
        />
      </div>
    );
  } catch {
    return <BackendError message="Unable to load benchmarking data. Please try again later." />;
  }
}
