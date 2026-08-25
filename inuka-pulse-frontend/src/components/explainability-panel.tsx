"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBandBadge } from "@/components/risk-band-badge";
import { AlertTriangle, CheckCircle2, Info, TrendingDown } from "lucide-react";

interface RiskDriver {
  featureName: string;
  displayName: string;
  impact: string;
  recommendation: string;
}

interface PredictionInterpretation {
  beneficiaryId: string;
  predictedBand: string;
  escalationProbability: number;
  confidenceLevel: string;
  topRiskDrivers: RiskDriver[];
  recommendedActions: string[];
  interpretationNarrative: string;
}

interface ExplainabilityPanelProps {
  beneficiaryId: string;
}

export function ExplainabilityPanel({ beneficiaryId }: ExplainabilityPanelProps) {
  const [data, setData] = useState<PredictionInterpretation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInterpretation() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/beneficiaries/predictions/${beneficiaryId}/interpretation`
        );
        if (!res.ok) {
          if (res.status === 404) {
            setError("No prediction data available for this beneficiary.");
          } else {
            setError("Failed to load interpretation data.");
          }
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Error connecting to the server.");
      } finally {
        setLoading(false);
      }
    }
    if (beneficiaryId) {
      fetchInterpretation();
    }
  }, [beneficiaryId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prediction Interpretation</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const probPercent = Math.round(data.escalationProbability * 100);
  const isHighRisk = data.predictedBand === "Dropout" || data.predictedBand === "Disengaged";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Prediction Interpretation</CardTitle>
          <RiskBandBadge band={data.predictedBand} />
        </div>
        <CardDescription>
          ML model insights for {data.beneficiaryId}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Escalation probability */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground mb-1">
              30-Day Escalation Probability
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${isHighRisk ? "text-red-600" : "text-amber-600"}`}>
                {probPercent}%
              </span>
              <Badge variant={data.confidenceLevel === "High" ? "default" : "secondary"}>
                {data.confidenceLevel} confidence
              </Badge>
            </div>
          </div>
          <div className="w-24 h-24">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="12"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={isHighRisk ? "#dc2626" : "#f59e0b"}
                strokeWidth="12"
                strokeDasharray={`${probPercent * 2.51} 251`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Narrative */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {data.interpretationNarrative}
          </AlertDescription>
        </Alert>

        {/* Risk drivers */}
        {data.topRiskDrivers.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Top Risk Drivers
            </h4>
            <div className="space-y-3">
              {data.topRiskDrivers.map((driver) => (
                <div
                  key={driver.featureName}
                  className="border rounded-lg p-3 bg-muted/30"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{driver.displayName}</span>
                    <Badge variant="outline" className="text-xs">
                      {driver.impact}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    → {driver.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended actions */}
        {data.recommendedActions.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Recommended Actions
            </h4>
            <ul className="space-y-2">
              {data.recommendedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-bold">{i + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
