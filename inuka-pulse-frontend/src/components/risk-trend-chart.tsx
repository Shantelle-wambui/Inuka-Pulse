"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { RiskTrend } from "@/lib/inuka-pulse/api";

interface RiskTrendChartProps {
  trend: RiskTrend;
  height?: number;
}

const BAND_COLORS: Record<string, string> = {
  Active:     "#22c55e",   // green-500
  "At-Risk":  "#f59e0b",   // amber-500
  Disengaged: "#f97316",   // orange-500
  Dropout:    "#ef4444",   // red-500
};

/**
 * RiskTrendChart — line chart showing how each risk band count has changed
 * across prediction pipeline snapshots over time.
 *
 * Each point on the X-axis is a pipeline run date (as_of_date).
 * When only one snapshot exists, the chart renders a single point with a
 * clear message that trends accumulate as the pipeline runs daily.
 */
export function RiskTrendChart({ trend, height = 280 }: RiskTrendChartProps) {
  // Convert series + dates into recharts row format:
  // [{ date: "2026-08-01", Active: 1100, "At-Risk": 620, ... }, ...]
  const chartData = trend.dates.map((date, i) => {
    const row: Record<string, string | number> = {
      date: formatDate(date),
    };
    for (const series of trend.series) {
      row[series.band] = series.data[i] ?? 0;
    }
    return row;
  });

  if (!trend.hasMultipleSnapshots) {
    // Single snapshot — show it clearly with a note
    return (
      <div className="flex flex-col gap-4">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {trend.series.map((s) => (
              <Line
                key={s.band}
                type="monotone"
                dataKey={s.band}
                stroke={BAND_COLORS[s.band] ?? "#888"}
                strokeWidth={2}
                dot={{ r: 5, fill: BAND_COLORS[s.band] ?? "#888" }}
                activeDot={{ r: 7 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center">
          Only one prediction snapshot available ({trend.dates[0]}).
          Trend data accumulates as the pipeline runs daily — check back tomorrow.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        {trend.series.map((s) => (
          <Line
            key={s.band}
            type="monotone"
            dataKey={s.band}
            stroke={BAND_COLORS[s.band] ?? "#888"}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
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
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
}
