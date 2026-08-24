import { BrainCircuit, BarChart2, FlaskConical, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Analyst Dashboard — /dashboard/analytics
 *
 * Technical ML and data analytics view. Shows model performance,
 * feature importance, and beneficiary risk distributions.
 *
 * This is a shell — real data will be wired in Phase 6.
 * The feature importance endpoint (/api/analytics/feature-importance)
 * and backtest report already exist and will be connected here.
 */
export default function AnalyticsDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <BrainCircuit className="size-7 text-primary" />
          ML Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          Model performance, feature importance, and beneficiary risk distribution.
          Technical view for analysts and ML administrators.
        </p>
      </div>

      {/* Model summary strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FlaskConical className="size-4" />
              Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">Logistic Regression</p>
            <p className="text-xs text-muted-foreground mt-1">v1 · inuka_logreg_v1</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Precision</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">0.359</p>
            <p className="text-xs text-muted-foreground mt-1">Test set</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recall</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">0.698</p>
            <p className="text-xs text-muted-foreground mt-1">Test set</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">F1 Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">0.474</p>
            <p className="text-xs text-muted-foreground mt-1">Harmonic mean</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature importance + prediction distribution */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="size-4" />
                Feature Importance
              </CardTitle>
              <Badge variant="outline" className="text-xs">Top 10 features</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-56 text-muted-foreground text-sm flex-col gap-2">
            <BarChart2 className="size-8 opacity-30" />
            <p>Horizontal bar chart — Coming in Phase 6</p>
            <p className="text-xs opacity-70">Data available at /api/analytics/feature-importance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="size-4" />
                Prediction Distribution
              </CardTitle>
              <Badge variant="outline" className="text-xs">2,173 beneficiaries</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-56 text-muted-foreground text-sm flex-col gap-2">
            <BrainCircuit className="size-8 opacity-30" />
            <p>Risk band doughnut chart — Coming in Phase 6</p>
            <p className="text-xs opacity-70">Active · At-Risk · Disengaged · Dropout</p>
          </CardContent>
        </Card>
      </div>

      {/* Model detail + data quality */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FlaskConical className="size-4" />
              Model Performance Detail
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Train/test split, positive rate, split date — Coming in Phase 6
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Database className="size-4" />
              Feature Dataset Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            56,498 rows · 16 columns · fact_beneficiary_features — Coming in Phase 6
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
