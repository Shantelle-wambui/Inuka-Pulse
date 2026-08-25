"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { TrendingDown, Award, GitBranch, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FunnelStage {
  stage: string;
  count: number;
  percent: number;
}

interface DropoutPhase {
  phase: string;
  dropoutRate: number;
}

interface PillarCompletion {
  pillar: string;
  completionRate: number;
}

interface Milestone {
  name: string;
  achieved: number;
}

interface JourneyChartsProps {
  funnel: FunnelStage[];
  dropoutByPhase: DropoutPhase[];
  byPillar: PillarCompletion[];
  milestones: Milestone[];
}

const FUNNEL_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"];
const DROPOUT_COLOR = "#ef4444";

const PILLAR_COLORS: Record<string, string> = {
  Scholarship: "#3b82f6",
  Plus: "#8b5cf6",
  Vocational: "#f59e0b",
  Tech: "#10b981",
};

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

/**
 * JourneyCharts — Client component rendering interactive Recharts visualizations
 * for the Cohort Journey & Completion page.
 */
export function JourneyCharts({
  funnel,
  dropoutByPhase,
  byPillar,
  milestones,
}: JourneyChartsProps) {
  // Add a "Dropped Out" entry to funnel for visualization
  const funnelWithDropout = [
    ...funnel,
    { stage: "Dropped Out", count: 155, percent: 18 },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── A. Journey Funnel ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="size-4" />
            Journey Funnel
          </CardTitle>
          <CardDescription className="text-xs">
            Beneficiary progression from intake through graduation. Bar width represents
            the proportion remaining at each stage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={funnelWithDropout}
              layout="vertical"
              margin={{ top: 8, right: 40, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="stage"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _name, props) => [
                  `${props.payload.count} beneficiaries (${value}%)`,
                  props.payload.stage,
                ]}
                labelFormatter={(label) => `Stage: ${label}`}
              />
              <Bar dataKey="percent" radius={[0, 4, 4, 0]} maxBarSize={40}>
                {funnelWithDropout.map((entry, index) => (
                  <Cell
                    key={entry.stage}
                    fill={
                      entry.stage === "Dropped Out"
                        ? DROPOUT_COLOR
                        : FUNNEL_COLORS[index % FUNNEL_COLORS.length]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-sm bg-blue-500" />
              <span>Progression stages</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-sm bg-red-500" />
              <span>Dropped out</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── B & C: Dropout by Phase + Completion by Pillar ────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* B. Dropout by Phase */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="size-4 text-red-500" />
              Dropout by Phase
            </CardTitle>
            <CardDescription className="text-xs">
              Percentage of beneficiaries lost during each transition phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dropoutByPhase} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="phase"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 40]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${value}%`, "Dropout Rate"]}
                  labelFormatter={(label) => `Phase: ${label}`}
                />
                <Bar dataKey="dropoutRate" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {dropoutByPhase.map((entry) => (
                    <Cell
                      key={entry.phase}
                      fill={entry.dropoutRate >= 25 ? "#ef4444" : "#f59e0b"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                Highest risk: Active → Completing (29%)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* C. Completion Rate by Pillar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4 text-green-500" />
              Completion Rate by Pillar
            </CardTitle>
            <CardDescription className="text-xs">
              Percentage of beneficiaries who completed the programme, grouped by pillar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byPillar} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="pillar"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${value}%`, "Completion Rate"]}
                  labelFormatter={(label) => `Pillar: ${label}`}
                />
                <Bar dataKey="completionRate" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {byPillar.map((entry) => (
                    <Cell
                      key={entry.pillar}
                      fill={PILLAR_COLORS[entry.pillar] ?? "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── D. Milestone Progress ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="size-4 text-amber-500" />
            Milestone Progress
          </CardTitle>
          <CardDescription className="text-xs">
            Percentage of active beneficiaries who have achieved each key programme milestone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestones.map((milestone) => (
              <div key={milestone.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{milestone.name}</span>
                  <span
                    className={cn(
                      "tabular-nums font-semibold",
                      milestone.achieved >= 60
                        ? "text-green-600 dark:text-green-400"
                        : milestone.achieved >= 45
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {milestone.achieved}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      milestone.achieved >= 60
                        ? "bg-green-500"
                        : milestone.achieved >= 45
                          ? "bg-amber-500"
                          : "bg-red-500"
                    )}
                    style={{ width: `${milestone.achieved}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
