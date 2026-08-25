"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, Scatter, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ControlChartData } from "@/lib/inuka-pulse/types";

interface PressureControlChartProps {
  data: ControlChartData;
  /** siteId → siteName map fetched from /api/sites/risk-summary by the parent Server Component */
  siteNames?: Record<string, string>;
}

const chartConfig = {
  pressure: { color: "var(--color-slate-400)", label: "Risk signal" },
  ewma: { color: "var(--color-blue-500)", label: "EWMA" },
  spike: { color: "var(--color-red-500)", label: "Critical threshold breach" },
} satisfies ChartConfig;

const SITE_LABELS: Record<string, string> = {}; // replaced by siteNames prop — see parent page

export function PressureControlChart({ data, siteNames = {} }: PressureControlChartProps) {
  const availableSites = Object.keys(data.sites).sort();
  const defaultSite = availableSites.includes("SITE-003") ? "SITE-003" : availableSites[0];
  const [selectedSite, setSelectedSite] = useState(defaultSite);

  const chart = data.sites[selectedSite];
  if (!chart) return null;

  const chartData = chart.readings.map((r) => ({
    time: new Date(r.timestamp).getTime(),
    pressure: r.pressure,
    ewma: r.ewma,
    drift: r.drift_flag ? r.ewma : null,
    spike: r.spike ? r.pressure : null,
  }));

  const ucl = chart.ucl;
  const lcl = chart.lcl;

  const tickFormatter = (v: number) => {
    if (!v || Number.isNaN(v)) return "";
    try {
      return format(new Date(v), "MMM d");
    } catch {
      return "";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium">EWMA Engagement Drift Monitor</CardTitle>
            <CardDescription className="text-xs">
              Statistical drift detectable before hard breach (λ={data.ewma_lambda}, L={data.ewma_L}σ)
            </CardDescription>
          </div>
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableSites.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {siteNames[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={tickFormatter}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              width={40}
              label={{ value: "Score", angle: -90, position: "insideLeft", fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => {
                    const ms = typeof v === "number" ? v : Number(v);
                    if (!ms || Number.isNaN(ms)) return "";
                    try {
                      return format(new Date(ms), "MMM d HH:mm");
                    } catch {
                      return "";
                    }
                  }}
                  formatter={(val, name) => [
                    typeof val === "number" ? `${val.toFixed(1)}` : val,
                    name,
                  ]}
                />
              }
            />

            {/* UCL / LCL reference lines */}
            <ReferenceLine y={ucl} stroke="var(--color-orange-400)" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "UCL", fontSize: 10, fill: "var(--color-orange-400)" }} />
            <ReferenceLine y={lcl} stroke="var(--color-orange-400)" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "LCL", fontSize: 10, fill: "var(--color-orange-400)" }} />
            {/* Hard spike threshold */}
            <ReferenceLine y={1000} stroke="var(--color-red-500)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "Critical", fontSize: 10, fill: "var(--color-red-500)" }} />

            {/* Raw pressure — thin, muted */}
            <Line
              dataKey="pressure"
              stroke="var(--color-slate-400)"
              strokeWidth={1}
              dot={false}
              connectNulls
              type="monotone"
            />
            {/* EWMA — prominent */}
            <Line
              dataKey="ewma"
              stroke="var(--color-blue-500)"
              strokeWidth={2}
              dot={false}
              connectNulls
              type="monotone"
            />
            {/* Drift flags — amber dots on EWMA line */}
            <Scatter dataKey="drift" fill="var(--color-amber-500)" shape="circle" />
            {/* Spikes — red dots */}
            <Scatter dataKey="spike" fill="var(--color-red-500)" shape="circle" />
          </ComposedChart>
        </ChartContainer>

        {/* Stats row */}
        <div className="rounded-md bg-muted px-3 py-2 text-xs grid grid-cols-3 gap-2">
          <div>
            <p className="text-muted-foreground">Breaches detected</p>
            <p className="font-semibold text-red-600 dark:text-red-400 tabular-nums">{chart.n_spikes}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Drift flags</p>
            <p className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{chart.n_drift_flags}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg lead time</p>
            <p className="font-semibold tabular-nums">
              {chart.lead_time_days > 0 ? `${chart.lead_time_days}d` : "—"}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Programme-wide average: drift detectable{" "}
          <span className="font-medium text-foreground">{data.fleet_avg_lead_time_days} days</span>{" "}
          before a hard breach
        </p>
      </CardContent>
    </Card>
  );
}
