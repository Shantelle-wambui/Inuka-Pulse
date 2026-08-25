"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Layers, CheckCircle2 } from "lucide-react";
import type { OutcomeModelMetrics, OutcomePredictions } from "@/lib/inuka-pulse/api";

interface OutcomeModelPanelProps {
  metrics: OutcomeModelMetrics | null;
  predictions: OutcomePredictions | null;
}

const PILLAR_COLORS: Record<string, string> = {
  Scholarship: "#6366f1",
  Plus:        "#22c55e",
  Vocational:  "#f59e0b",
  Tech:        "#3b82f6",
};

function fmtPct(n: number | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

/**
 * OutcomeModelPanel — shows two cards:
 *
 * 1. Outcome model performance metrics (GradientBoosting):
 *    accuracy, precision, recall, F1, AUC-ROC, feature importance bar chart
 *
 * 2. Completion probability by pillar (from outcome_predictions.json):
 *    summary KPI strip + horizontal bar chart per pillar
 */
export function OutcomeModelPanel({ metrics, predictions }: OutcomeModelPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

      {/* ── Outcome Model Metrics ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="size-4" />
                Outcome Model
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {metrics?.model_type ?? "GradientBoosting"} — completion probability predictor
              </CardDescription>
            </div>
            {metrics?.trained_at && (
              <Badge variant="outline" className="text-xs shrink-0">
                {new Date(metrics.trained_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!metrics ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Outcome model not yet run — run the pipeline diagnostics.
            </div>
          ) : (
            <>
              {/* Metric strip */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Accuracy",  value: fmtPct(metrics.accuracy),  color: "text-primary" },
                  { label: "AUC-ROC",   value: fmtPct(metrics.auc_roc),   color: "text-purple-600 dark:text-purple-400" },
                  { label: "Precision", value: fmtPct(metrics.precision),  color: "text-blue-600 dark:text-blue-400" },
                  { label: "Recall",    value: fmtPct(metrics.recall),     color: "text-green-600 dark:text-green-400" },
                  { label: "F1 Score",  value: fmtPct(metrics.f1),         color: "text-amber-600 dark:text-amber-400" },
                  { label: "Samples",   value: fmtNum(metrics.n_samples),  color: "" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Feature importance */}
              {metrics.feature_importance && metrics.feature_importance.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Top features</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart
                      data={metrics.feature_importance.slice(0, 5).map((f) => ({
                        name: f.feature.replace(/_/g, " "),
                        importance: f.importance,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={128}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0];
                          return (
                            <div style={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 6,
                              padding: "6px 10px",
                              fontSize: 11,
                            }}>
                              <p>{p.payload?.name}</p>
                              <p><strong>{(Number(p.value) * 100).toFixed(1)}%</strong> importance</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="importance" radius={[0, 3, 3, 0]} maxBarSize={14}>
                        {metrics.feature_importance.slice(0, 5).map((_, i) => (
                          <Cell key={i} fill="#6366f1" fillOpacity={1 - i * 0.15} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Completion Probability by Pillar ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="size-4" />
            Predicted Completion
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Average completion probability per programme pillar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!predictions?.summary ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No outcome predictions — run the pipeline.
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Likely to complete</p>
                  <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
                    {fmtNum(predictions.summary.likely_to_complete)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    of {fmtNum(predictions.summary.total_predictions)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg probability</p>
                  <p className="text-xl font-bold tabular-nums text-primary">
                    {fmtPct(predictions.summary.avg_completion_probability)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="size-3 text-amber-500" /> At risk
                  </p>
                  <p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {fmtNum(predictions.summary.at_risk)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-blue-500" /> Moderate
                  </p>
                  <p className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    {fmtNum(predictions.summary.moderate)}
                  </p>
                </div>
              </div>

              {/* By pillar bars */}
              {predictions.by_pillar && Object.keys(predictions.by_pillar).length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">By pillar</p>
                  <div className="space-y-2.5">
                    {Object.entries(predictions.by_pillar).map(([pillar, data]) => {
                      const pct = Math.round(data.avg_probability * 100);
                      const color = PILLAR_COLORS[pillar] ?? "#888";
                      return (
                        <div key={pillar}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{pillar}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {pct}% · {fmtNum(data.count)} beneficiaries
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
