"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface RadarDataPoint {
  dimension: string;
  Scholarship: number;
  Plus: number;
  Vocational: number;
  Tech: number;
}

interface CountyRankingRow {
  county: string;
  active: number;
  atRiskPct: number;
  avgEngagement: number;
  completionRate: number;
  performanceIndex: number;
}

interface HeatmapRow {
  pillar: string;
  Mombasa: number;
  Nairobi: number;
  Kisumu: number;
}

interface BenchmarkingChartsProps {
  radarData: RadarDataPoint[];
  countyRanking: CountyRankingRow[];
  heatmap: HeatmapRow[];
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const PILLAR_COLORS = {
  Scholarship: "#00999E",
  Plus: "#C42152",
  Vocational: "#f59e0b",
  Tech: "#3b82f6",
} as const;

const COUNTIES = ["Mombasa", "Nairobi", "Kisumu"] as const;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getPerformanceBadge(index: number) {
  if (index > 70) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
        {index}
      </Badge>
    );
  }
  if (index >= 50) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
        {index}
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
      {index}
    </Badge>
  );
}

function getHeatmapCellClass(value: number) {
  if (value > 70) return "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-300";
  if (value >= 50) return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300";
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * BenchmarkingCharts — client component for interactive Recharts visuals.
 * Renders radar chart, county ranking table, and pillar × county heatmap.
 */
export function BenchmarkingCharts({ radarData, countyRanking, heatmap }: BenchmarkingChartsProps) {
  return (
    <div className="space-y-6">
      {/* A. Pillar Comparison Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            Pillar Comparison Radar
          </CardTitle>
          <CardDescription>
            Multi-dimensional comparison across Attendance, Engagement, Completion,
            Disbursement Compliance, and Assessment Scores for each programme pillar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickCount={5}
              />
              <Radar
                name="Scholarship"
                dataKey="Scholarship"
                stroke={PILLAR_COLORS.Scholarship}
                fill={PILLAR_COLORS.Scholarship}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Radar
                name="Plus"
                dataKey="Plus"
                stroke={PILLAR_COLORS.Plus}
                fill={PILLAR_COLORS.Plus}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Radar
                name="Vocational"
                dataKey="Vocational"
                stroke={PILLAR_COLORS.Vocational}
                fill={PILLAR_COLORS.Vocational}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Radar
                name="Tech"
                dataKey="Tech"
                stroke={PILLAR_COLORS.Tech}
                fill={PILLAR_COLORS.Tech}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconType="line"
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* B. County Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle>County Performance Ranking</CardTitle>
          <CardDescription>
            Counties ranked by composite Performance Index (0–100). Green &gt;70, Amber 50–70, Red &lt;50.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">County</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Active Beneficiaries</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">At-Risk %</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Avg Engagement</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Completion Rate</th>
                  <th className="pb-3 font-medium text-muted-foreground text-right">Performance Index</th>
                </tr>
              </thead>
              <tbody>
                {countyRanking.map((row, idx) => (
                  <tr
                    key={row.county}
                    className={cn(
                      "border-b last:border-0",
                      idx === 0 && "bg-muted/30"
                    )}
                  >
                    <td className="py-3 font-medium">{row.county}</td>
                    <td className="py-3 text-right">{row.active.toLocaleString()}</td>
                    <td className="py-3 text-right">{row.atRiskPct}%</td>
                    <td className="py-3 text-right">{row.avgEngagement}</td>
                    <td className="py-3 text-right">{row.completionRate}%</td>
                    <td className="py-3 text-right">
                      {getPerformanceBadge(row.performanceIndex)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* C. Pillar × County Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Pillar × County Heatmap</CardTitle>
          <CardDescription>
            Performance index for each pillar–county combination. Cell colors indicate
            relative performance: green (&gt;70), amber (50–70), red (&lt;50).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">Pillar</th>
                  {COUNTIES.map((county) => (
                    <th
                      key={county}
                      className="pb-3 font-medium text-muted-foreground text-center"
                    >
                      {county}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.map((row) => (
                  <tr key={row.pillar} className="border-b last:border-0">
                    <td className="py-3 font-medium">{row.pillar}</td>
                    {COUNTIES.map((county) => {
                      const value = row[county];
                      return (
                        <td key={county} className="py-3 text-center">
                          <span
                            className={cn(
                              "inline-block rounded-md px-3 py-1 text-xs font-semibold",
                              getHeatmapCellClass(value)
                            )}
                          >
                            {value}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
