"use client";

import { useState, useEffect } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BrainCircuit,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  FlaskConical,
  Layers,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchModelComparison } from "@/lib/inuka-pulse/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelMetrics {
  name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  trainedAt: string;
  samples: number;
}

interface FamilyData {
  champion: ModelMetrics;
  challenger: ModelMetrics | null;
}

type FamilyKey = "dropout" | "demand" | "reach" | "outcome" | "allocation";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const FAMILY_DATA: Record<FamilyKey, FamilyData> = {
  dropout: {
    champion: {
      name: "LogReg v1",
      accuracy: 0.82,
      precision: 0.79,
      recall: 0.85,
      f1: 0.82,
      trainedAt: "2026-07-15",
      samples: 56498,
    },
    challenger: {
      name: "XGBoost v0.1",
      accuracy: 0.86,
      precision: 0.83,
      recall: 0.88,
      f1: 0.855,
      trainedAt: "2026-08-10",
      samples: 56498,
    },
  },
  demand: {
    champion: {
      name: "LightGBM v1",
      accuracy: 0.78,
      precision: 0.75,
      recall: 0.8,
      f1: 0.77,
      trainedAt: "2026-06-20",
      samples: 12400,
    },
    challenger: null,
  },
  reach: {
    champion: {
      name: "LightGBM v1",
      accuracy: 0.74,
      precision: 0.71,
      recall: 0.76,
      f1: 0.73,
      trainedAt: "2026-06-20",
      samples: 8900,
    },
    challenger: null,
  },
  outcome: {
    champion: {
      name: "GradientBoosting v1",
      accuracy: 0.8,
      precision: 0.77,
      recall: 0.82,
      f1: 0.795,
      trainedAt: "2026-07-01",
      samples: 42000,
    },
    challenger: {
      name: "XGBoost v0.2",
      accuracy: 0.83,
      precision: 0.8,
      recall: 0.85,
      f1: 0.825,
      trainedAt: "2026-08-05",
      samples: 42000,
    },
  },
  allocation: {
    champion: {
      name: "Weighted Formula v1",
      accuracy: 0.72,
      precision: 0.7,
      recall: 0.74,
      f1: 0.72,
      trainedAt: "2026-05-15",
      samples: 3200,
    },
    challenger: null,
  },
};

const FAMILY_META: Record<
  FamilyKey,
  { label: string; description: string; icon: typeof BrainCircuit }
> = {
  dropout: {
    label: "Dropout",
    description: "Logistic Regression predicting beneficiary dropout probability",
    icon: TrendingUp,
  },
  demand: {
    label: "Demand",
    description: "Forecasting programme demand by region/pillar",
    icon: Layers,
  },
  reach: {
    label: "Reach",
    description: "Predicting beneficiary reach/coverage",
    icon: Users,
  },
  outcome: {
    label: "Outcome",
    description: "Predicting programme completion probability (GradientBoosting)",
    icon: Target,
  },
  allocation: {
    label: "Allocation",
    description: "Weighted formula recommending resource allocation",
    icon: BrainCircuit,
  },
};

const FAMILIES: FamilyKey[] = ["dropout", "demand", "reach", "outcome", "allocation"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function computeDelta(champion: number, challenger: number): number {
  return (challenger - champion) * 100;
}

function DeltaBadge({ delta }: { delta: number }) {
  const isPositive = delta >= 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "ml-2 text-xs font-medium",
        isPositive
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-400"
      )}
    >
      {isPositive ? (
        <ArrowUpRight className="mr-0.5 h-3 w-3" />
      ) : (
        <ArrowDownRight className="mr-0.5 h-3 w-3" />
      )}
      {isPositive ? "+" : ""}
      {delta.toFixed(1)}%
    </Badge>
  );
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: number;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center">
        <span className="text-sm font-semibold">{formatPct(value)}</span>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>
    </div>
  );
}

// ─── Model Card ───────────────────────────────────────────────────────────────

function ChampionCard({ model }: { model: ModelMetrics }) {
  return (
    <Card className="border-emerald-200 dark:border-emerald-800 flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">Champion</CardTitle>
        </div>
        <CardDescription className="flex items-center gap-2 mt-1">
          <span className="font-medium text-foreground">{model.name}</span>
          <Badge variant="secondary" className="text-xs">
            Production
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <MetricRow label="Accuracy" value={model.accuracy} />
        <MetricRow label="Precision" value={model.precision} />
        <MetricRow label="Recall" value={model.recall} />
        <MetricRow label="F1 Score" value={model.f1} />
        <div className="mt-4 pt-3 border-t border-border space-y-1">
          <p className="text-xs text-muted-foreground">
            Trained: {new Date(model.trainedAt).toLocaleDateString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Samples: {model.samples.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChallengerCard({
  model,
  champion,
}: {
  model: ModelMetrics;
  champion: ModelMetrics;
}) {
  return (
    <Card className="border-blue-200 border-dashed dark:border-blue-800 flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-base">Challenger</CardTitle>
        </div>
        <CardDescription className="flex items-center gap-2 mt-1">
          <span className="font-medium text-foreground">{model.name}</span>
          <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">
            Candidate
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <MetricRow
          label="Accuracy"
          value={model.accuracy}
          delta={computeDelta(champion.accuracy, model.accuracy)}
        />
        <MetricRow
          label="Precision"
          value={model.precision}
          delta={computeDelta(champion.precision, model.precision)}
        />
        <MetricRow
          label="Recall"
          value={model.recall}
          delta={computeDelta(champion.recall, model.recall)}
        />
        <MetricRow
          label="F1 Score"
          value={model.f1}
          delta={computeDelta(champion.f1, model.f1)}
        />
        <div className="mt-4 pt-3 border-t border-border space-y-1">
          <p className="text-xs text-muted-foreground">
            Trained: {new Date(model.trainedAt).toLocaleDateString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Samples: {model.samples.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function NoChallengerCard() {
  return (
    <Card className="border-dashed flex-1 flex items-center justify-center min-h-[280px]">
      <CardContent className="text-center py-8">
        <FlaskConical className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          No challenger model registered for this family
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Train a new model and register it via the ML Registry to begin comparison.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Family Tab Content ───────────────────────────────────────────────────────

function FamilyTabContent({
  familyKey,
  data,
  isLive,
}: {
  familyKey: FamilyKey;
  data: FamilyData;
  isLive: boolean;
}) {
  const meta = FAMILY_META[familyKey];

  return (
    <div className="space-y-4">
      {/* Family description */}
      <div className="flex items-center gap-2">
        <meta.icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{meta.description}</p>
        {!isLive && (
          <Badge variant="outline" className="ml-auto text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
            Model not yet deployed — metrics shown are targets
          </Badge>
        )}
      </div>

      {/* Comparison cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChampionCard model={data.champion} />
        {data.challenger ? (
          <ChallengerCard model={data.challenger} champion={data.champion} />
        ) : (
          <NoChallengerCard />
        )}
      </div>

      {/* Metric diff summary bar */}
      {data.challenger && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Metric Delta Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(["accuracy", "precision", "recall", "f1"] as const).map((metric) => {
                const delta = computeDelta(
                  data.champion[metric],
                  data.challenger![metric]
                );
                const isPositive = delta >= 0;
                return (
                  <div key={metric} className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground capitalize">{metric === "f1" ? "F1 Score" : metric}</p>
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "absolute top-0 left-1/2 h-full rounded-full",
                          isPositive ? "bg-emerald-500" : "bg-red-500"
                        )}
                        style={{
                          width: `${Math.min(Math.abs(delta) * 5, 50)}%`,
                          transform: isPositive ? "none" : "translateX(-100%)",
                        }}
                      />
                    </div>
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {delta.toFixed(1)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promotion controls */}
      <div className="flex items-center justify-end gap-3">
        <p className="text-xs text-muted-foreground italic">
          Requires HITL approval in production
        </p>
        <Button disabled size="sm" className="gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5" />
          Promote Challenger
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModelCompareView() {
  const [activeFamily, setActiveFamily] = useState<FamilyKey>("dropout");
  const [dropoutLiveData, setDropoutLiveData] = useState<FamilyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Attempt to fetch live data for the dropout family
  useEffect(() => {
    let cancelled = false;

    async function loadLiveDropout() {
      setIsLoading(true);
      try {
        const result = await fetchModelComparison();
        if (cancelled) return;

        // Map API response to our FamilyData structure
        if (result.champion) {
          const champion: ModelMetrics = {
            name: (result.champion.version as string) ?? "LogReg v1",
            accuracy:
              ((result.champion.accuracy as number) ??
                (result.champion.precisionScore as number) ??
                0.82),
            precision: (result.champion.precisionScore as number) ?? 0.79,
            recall: (result.champion.recallScore as number) ?? 0.85,
            f1: (result.champion.f1Score as number) ?? 0.82,
            trainedAt: (result.champion.trainedAt as string) ?? "2026-07-15",
            samples: (result.champion.trainingSamples as number) ?? 56498,
          };

          let challenger: ModelMetrics | null = null;
          if (result.challenger) {
            challenger = {
              name: (result.challenger.version as string) ?? "XGBoost v0.1",
              accuracy:
                ((result.challenger.accuracy as number) ??
                  (result.challenger.precisionScore as number) ??
                  0.86),
              precision: (result.challenger.precisionScore as number) ?? 0.83,
              recall: (result.challenger.recallScore as number) ?? 0.88,
              f1: (result.challenger.f1Score as number) ?? 0.855,
              trainedAt: (result.challenger.trainedAt as string) ?? "2026-08-10",
              samples: (result.challenger.trainingSamples as number) ?? 56498,
            };
          }

          setDropoutLiveData({ champion, challenger });
        }
      } catch {
        // Fall back to mock data silently
        setDropoutLiveData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLiveDropout();
    return () => {
      cancelled = true;
    };
  }, []);

  function getDataForFamily(family: FamilyKey): FamilyData {
    if (family === "dropout" && dropoutLiveData) {
      return dropoutLiveData;
    }
    return FAMILY_DATA[family];
  }

  return (
    <Tabs
      value={activeFamily}
      onValueChange={(v) => setActiveFamily(v as FamilyKey)}
      className="space-y-4"
    >
      <TabsList className="grid w-full grid-cols-5">
        {FAMILIES.map((key) => {
          const meta = FAMILY_META[key];
          const Icon = meta.icon;
          return (
            <TabsTrigger
              key={key}
              value={key}
              className="gap-1.5 text-xs sm:text-sm"
            >
              <Icon className="h-3.5 w-3.5 hidden sm:inline-block" />
              {meta.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {FAMILIES.map((key) => (
        <TabsContent key={key} value={key} className="space-y-4">
          {key === "dropout" && isLoading ? (
            <div className="flex items-center justify-center py-12">
              <BrainCircuit className="h-6 w-6 animate-pulse text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading live model data…
              </span>
            </div>
          ) : (
            <FamilyTabContent
              familyKey={key}
              data={getDataForFamily(key)}
              isLive={key === "dropout" && dropoutLiveData !== null}
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
