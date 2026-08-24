"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// ── Types matching actual inuka_survival_curve_data.json shape ────────────────

export interface InukaSurvivalSeries {
  label: string;
  timeline: number[];
  survival: number[];       // actual field name in pipeline output
  ci_upper?: number[];
  ci_lower?: number[];
  median_days?: number;
  n?: number;
}

export interface InukaSurvivalCurveData {
  series: InukaSurvivalSeries[];
  headline?: Record<string, unknown>;
}

interface SurvivalCurveChartProps {
  data: InukaSurvivalCurveData;
  height?: number;
}

const SERIES_COLORS = [
  "#6366f1",  // indigo  — All Pillars
  "#22c55e",  // green   — Scholarship
  "#f59e0b",  // amber   — Plus
  "#f97316",  // orange  — Vocational
  "#3b82f6",  // blue    — Tech
];

/**
 * SurvivalCurveChart — Kaplan-Meier retention curve.
 *
 * X-axis: days in programme.
 * Y-axis: % of beneficiaries still retained.
 * Dashed 50% reference line marks the median survival point.
 *
 * Data source: inuka_survival_curve_data.json
 * Field used: series[].survival (not survival_prob)
 */
export function SurvivalCurveChart({ data, height = 300 }: SurvivalCurveChartProps) {
  if (!data?.series || data.series.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No survival curve data — run the pipeline diagnostics.
      </div>
    );
  }

  // Build lookup: label -> Map<day, survival%>
  const lookup = new Map<string, Map<number, number>>();
  for (const s of data.series) {
    const m = new Map<number, number>();
    s.timeline.forEach((day: number, i: number) => {
      m.set(day, (s.survival[i] ?? 1) * 100); // convert 0-1 to %
    });
    lookup.set(s.label, m);
  }

  // Cap at 365 days for readability
  const allDays = new Set<number>();
  for (const s of data.series) {
    for (const d of s.timeline) if (d <= 365) allDays.add(d);
  }
  const sortedDays = Array.from(allDays).sort((a, b) => a - b);

  // Convert to recharts row format using step-function (last known value)
  const chartData = sortedDays.map((day) => {
    const row: Record<string, number> = { day };
    for (const s of data.series) {
      const m = lookup.get(s.label);
      if (!m) continue;
      const knownDays = Array.from(m.keys()).filter((d: number) => d <= day);
      if (knownDays.length > 0) {
        const lastDay = Math.max(...knownDays);
        row[s.label] = m.get(lastDay) ?? 100;
      } else {
        row[s.label] = 100;
      }
    }
    return row;
  });

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="day"
            label={{ value: "Days in programme", position: "insideBottom", offset: -12, fontSize: 11 }}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            height={40}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                }}>
                  <p className="font-semibold mb-1">Day {label}</p>
                  {payload.map((p) => (
                    <p key={String(p.name)} style={{ color: p.color as string }}>
                      {p.name}: <strong>{Number(p.value).toFixed(1)}%</strong> retained
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={50}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            label={{ value: "50% retained", position: "insideTopRight", fontSize: 10 }}
          />
          {data.series.map((s: InukaSurvivalSeries, i: number) => (
            <Line
              key={s.label}
              type="stepAfter"
              dataKey={s.label}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={i === 0 ? 2.5 : 1.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Median survival info strip */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground px-1">
        {data.series.map((s: InukaSurvivalSeries, i: number) => (
          s.median_days != null && (
            <span key={s.label} style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}>
              <strong>{s.label}</strong>: median {Math.round(s.median_days)} days
              {s.n != null && ` (n=${s.n.toLocaleString()})`}
            </span>
          )
        ))}
      </div>
    </div>
  );
}
