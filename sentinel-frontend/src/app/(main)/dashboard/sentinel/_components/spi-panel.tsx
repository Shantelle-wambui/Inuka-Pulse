"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

interface SpiSummary {
  hazardReportsThisMonth: number;
  avgCapaClosureDays: number;
  pctCapasClosedOnTime: number;
  overdueCapas: number;
  hazardReportTrend: { month: string; count: number }[];
  incidents30d: number;
  highCriticalIncidents30d: number;
}

export function SpiPanel({ spi }: { spi: SpiSummary | null }) {
  if (!spi) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Programme Performance Indicators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

          {/* Proactive — field welfare reports */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Field reports this month</p>
            <div className="flex items-end gap-3">
              <p className="text-2xl font-bold tabular-nums">{spi.hazardReportsThisMonth}</p>
              {spi.hazardReportTrend.length > 1 && (
                <div className="h-8 w-16 mb-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spi.hazardReportTrend}>
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f620" strokeWidth={1.5} dot={false} />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="rounded border bg-background px-2 py-1 text-xs shadow">
                              {payload[0].payload.month}: {payload[0].value}
                            </div>
                          ) : null
                        }
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Proactive indicator</p>
          </div>

          {/* Avg intervention closure time */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg intervention closure</p>
            <p className="text-2xl font-bold tabular-nums">
              {spi.avgCapaClosureDays || 0}{" "}
              <span className="text-sm font-normal">days</span>
            </p>
            <p className="text-xs text-muted-foreground">Proactive indicator</p>
          </div>

          {/* On-time follow-up rate */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">On-time follow-up rate</p>
            <p className="text-2xl font-bold tabular-nums">
              {spi.pctCapasClosedOnTime || 0}<span className="text-sm font-normal">%</span>
            </p>
            {spi.overdueCapas > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400">{spi.overdueCapas} overdue</p>
            )}
          </div>

          {/* Outcome — at-risk flags */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">At-risk flags (30d)</p>
            <p className="text-2xl font-bold tabular-nums">{spi.incidents30d}</p>
            <p className="text-xs text-muted-foreground">Outcome indicator</p>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
