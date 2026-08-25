"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

export interface FeatureImportanceEntry {
  feature: string;
  coefficient: number;
  importance: number;
}

interface FeatureImportanceChartProps {
  data: FeatureImportanceEntry[];
  height?: number;
}

/**
 * Horizontal bar chart showing ML feature importance values.
 *
 * Bars are colour-coded by the sign of the coefficient:
 *   negative coefficient → green  (higher value = lower risk)
 *   positive coefficient → red    (higher value = higher risk)
 *
 * This gives the Analyst both the magnitude (bar length) and direction
 * (colour) of each feature's influence on the dropout prediction.
 */
export function FeatureImportanceChart({ data, height = 340 }: FeatureImportanceChartProps) {
  // Sort descending by importance, keep top 10
  const sorted = [...data]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map((d) => ({
      ...d,
      // Human-friendly label: replace underscores, trim "_30d" etc.
      label: d.feature.replace(/_/g, " "),
      // direction text for tooltip
      direction: d.coefficient < 0 ? "↓ lower risk when higher" : "↑ higher risk when higher",
    }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          domain={[0, "dataMax"]}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={172}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as typeof sorted[number];
            return (
              <div
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                }}
              >
                <p className="font-semibold mb-1">{label}</p>
                <p>{(d.importance * 100).toFixed(1)}% importance</p>
                <p className="text-muted-foreground text-xs">
                  Coefficient: {d.coefficient > 0 ? "+" : ""}{d.coefficient.toFixed(4)}
                </p>
                <p className="text-muted-foreground text-xs">{d.direction}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="importance" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {sorted.map((entry) => (
            <Cell
              key={entry.feature}
              fill={entry.coefficient < 0 ? "#22c55e" : "#ef4444"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
