"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskBandBadge } from "@/components/risk-band-badge";
import type { BeneficiaryPrediction } from "@/lib/inuka-pulse/api";

interface AtRiskPanelProps {
  atRisk: BeneficiaryPrediction[];
  dropout: BeneficiaryPrediction[];
}

function BeneficiaryRow({ b, onClick }: { b: BeneficiaryPrediction; onClick: () => void }) {
  const features = b.topFeaturesList?.slice(0, 2) ?? [];
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3 group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold">{b.beneficiaryId}</span>
          <RiskBandBadge band={b.predictedBand} />
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {b.dropoutProbPct}
          </span>
        </div>
        <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
          {b.county && <span>{b.county}</span>}
          {b.pillar && <span>{b.pillar}</span>}
          {features.map(f => (
            <span key={f} className="bg-muted rounded px-1.5 py-0.5">
              {f.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

export function DirectorAtRiskPanel({ atRisk, dropout }: AtRiskPanelProps) {
  const router = useRouter();

  const goTo = (id: string) =>
    router.push(`/dashboard/case-manager/beneficiary/${encodeURIComponent(id)}`);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

      {/* Predicted dropout */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="size-4 text-red-500" />
                Predicted Dropout
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Highest dropout probability — immediate intervention needed
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">Top {dropout.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dropout.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground text-sm px-4">
              No dropout predictions loaded yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dropout.map(b => (
                <BeneficiaryRow key={b.beneficiaryId} b={b} onClick={() => goTo(b.beneficiaryId)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* At-risk */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                Top At-Risk
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Warning signs present — follow up before they disengage
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">Top {atRisk.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {atRisk.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground text-sm px-4">
              No at-risk predictions loaded yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {atRisk.map(b => (
                <BeneficiaryRow key={b.beneficiaryId} b={b} onClick={() => goTo(b.beneficiaryId)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
