"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// ── Shared colour palette ─────────────────────────────────────────────────────

export const BAND_COLORS: Record<string, string> = {
  Active:     "#22c55e",   // green-500
  "At-Risk":  "#f59e0b",   // amber-500
  Disengaged: "#f97316",   // orange-500
  Dropout:    "#ef4444",   // red-500
};

const BANDS = ["Active", "At-Risk", "Disengaged", "Dropout"];

// ── Horizontal bar chart — county or pillar breakdown ─────────────────────────

interface GroupedBarChartProps {
  data: Record<string, Record<string, number>>;
  /** Label for the Y-axis category (e.g. "County" or "Pillar") */
  categoryLabel?: string;
  height?: number;
}

/**
 * Grouped horizontal bar chart showing band counts per county or pillar.
 *
 * data format:
 * {
 *   "Nairobi":  { "Active": 300, "At-Risk": 120, "Disengaged": 80, "Dropout": 40 },
 *   "Mombasa":  { ... }
 * }
 */
export function RiskGroupedBarChart({
  data,
  categoryLabel = "Group",
  height = 280,
}: GroupedBarChartProps) {
  // Convert { county: { band: count } } to recharts-friendly array
  const chartData = Object.entries(data).map(([name, bands]) => ({
    name,
    ...bands,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
        {BANDS.map((band) => (
          <Bar key={band} dataKey={band} stackId="a" fill={BAND_COLORS[band]} radius={0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Doughnut chart — overall band distribution ────────────────────────────────

interface DonutChartProps {
  active: number;
  atRisk: number;
  disengaged: number;
  dropout: number;
  height?: number;
}

export function RiskDonutChart({
  active,
  atRisk,
  disengaged,
  dropout,
  height = 200,
}: DonutChartProps) {
  const chartData = [
    { name: "Active",     value: active,     color: BAND_COLORS["Active"] },
    { name: "At-Risk",    value: atRisk,      color: BAND_COLORS["At-Risk"] },
    { name: "Disengaged", value: disengaged,  color: BAND_COLORS["Disengaged"] },
    { name: "Dropout",    value: dropout,     color: BAND_COLORS["Dropout"] },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0];
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
                <p className="font-semibold">{d.name}</p>
                <p>{Number(d.value).toLocaleString()} beneficiaries</p>
              </div>
            );
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
