"use client";

import { useState } from "react";

import { Layers, List, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CorridorAsset, HeatPoint } from "@/lib/inuka-pulse/corridor";
import { cn } from "@/lib/utils";

interface CorridorAssetListProps {
  points: HeatPoint[];
  assets: CorridorAsset[];
  selectedAssetId: string | null;
  onSelect: (assetId: string | null) => void;
}

const BAND_CLASSES: Record<HeatPoint["band"], string> = {
  critical: "bg-red-100 text-red-700 ring-red-300 dark:bg-red-950/80 dark:text-red-400 dark:ring-red-500/40",
  high:     "bg-orange-100 text-orange-700 ring-orange-300 dark:bg-orange-950/70 dark:text-orange-400 dark:ring-orange-500/40",
  medium:   "bg-yellow-100 text-yellow-700 ring-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-400 dark:ring-yellow-500/30",
  low:      "bg-green-100 text-green-700 ring-green-300 dark:bg-green-950/70 dark:text-green-400 dark:ring-green-500/40",
};

const BAND_DOT: Record<HeatPoint["band"], string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-yellow-500",
  low:      "bg-green-500",
};

const SELECTED_RING: Record<HeatPoint["band"], string> = {
  critical: "ring-2 ring-red-500",
  high:     "ring-2 ring-orange-500",
  medium:   "ring-2 ring-yellow-500",
  low:      "ring-2 ring-green-500",
};

/**
 * Derive a human-readable pillar label from the cohort assetId.
 * Format: "cohort-sc-001" → "Scholarship", "cohort-pl-002" → "Plus", etc.
 */
function pillarFromId(assetId: string): string {
  const code = assetId.split("-")[1]?.toLowerCase();
  const pillars: Record<string, string> = {
    sc: "Scholarship",
    pl: "Plus",
    vn: "Vocational",
    tc: "Tech",
  };
  return pillars[code ?? ""] ?? "Programme";
}

/**
 * Last field visit label derived from floodLandslideRiskZone (repurposed field).
 * high_flood = 21+ days overdue, moderate_flood = 8–20 days, low = within 7 days.
 */
function visitLabel(zone: string): { label: string; cls: string } {
  if (zone === "high_flood")     return { label: "21+ days since visit", cls: "text-red-600 dark:text-red-400" };
  if (zone === "moderate_flood") return { label: "8–20 days since visit", cls: "text-amber-600 dark:text-amber-400" };
  return { label: "Within 7 days",     cls: "text-green-600 dark:text-green-400" };
}

export function CorridorAssetList({ points, assets, selectedAssetId, onSelect }: CorridorAssetListProps) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "pillar">("list");

  // Join points → cohort metadata
  const assetMap = new Map(assets.map((a) => [a.assetId, a]));

  const sorted = [...points].sort((a, b) => b.weight - a.weight);

  const filtered = query
    ? sorted.filter((p) => {
        const meta = assetMap.get(p.assetId);
        return (
          p.assetId.toLowerCase().includes(query.toLowerCase()) ||
          p.band.toLowerCase().includes(query.toLowerCase()) ||
          meta?.segment?.toLowerCase().includes(query.toLowerCase()) ||   // county
          pillarFromId(p.assetId).toLowerCase().includes(query.toLowerCase())
        );
      })
    : sorted;

  const counts = points.reduce(
    (acc, p) => ({ ...acc, [p.band]: (acc[p.band] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  // Group by pillar for the pillar view
  const byPillar = filtered.reduce((acc, p) => {
    const pillar = pillarFromId(p.assetId);
    if (!acc[pillar]) acc[pillar] = [];
    acc[pillar].push(p);
    return acc;
  }, {} as Record<string, HeatPoint[]>);

  const pillarEntries = Object.entries(byPillar).sort(([, aPoints], [, bPoints]) => {
    const aMax = Math.max(...aPoints.map((p) => p.weight));
    const bMax = Math.max(...bPoints.map((p) => p.weight));
    return bMax - aMax;
  });

  return (
    <Card className="flex h-full flex-col rounded-none ring-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-normal">Cohort Risk Map</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("list")}
              title="All cohorts"
            >
              <List className="size-4" />
            </Button>
            <Button
              variant={viewMode === "pillar" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("pillar")}
              title="Group by pillar"
            >
              <Layers className="size-4" />
            </Button>
          </div>
        </div>

        {/* Risk band summary pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(["critical", "high", "medium", "low"] as HeatPoint["band"][]).map((b) => (
            <span
              key={b}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1",
                BAND_CLASSES[b],
              )}
            >
              <span className={cn("size-1.5 rounded-full", BAND_DOT[b])} />
              {b.charAt(0).toUpperCase() + b.slice(1)}: {counts[b] ?? 0}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden px-4 pb-4">
        <InputGroup className="h-8">
          <InputGroupInput
            className="h-8"
            aria-label="Search cohorts"
            placeholder="Search by county, pillar, or risk band…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>

        <ScrollArea className="h-0 flex-1">
          {viewMode === "list" ? (
            /* ── Flat list — sorted by risk score descending ──────────── */
            <div className="flex flex-col gap-2 pr-2">
              {filtered.map((p) => {
                const meta = assetMap.get(p.assetId);
                const isSelected = p.assetId === selectedAssetId;
                const county = meta?.segment ?? "—";
                const pillar = pillarFromId(p.assetId);
                const atRisk = meta && meta.chainageKmApprox > 0
                  ? Math.round(meta.chainageKmApprox)
                  : null;
                const visit = meta ? visitLabel(meta.floodLandslideRiskZone) : null;

                return (
                  <button
                    key={p.assetId}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(isSelected ? null : p.assetId)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 ring-1 transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2",
                      BAND_CLASSES[p.band],
                      isSelected && SELECTED_RING[p.band],
                    )}
                  >
                    {/* Row 1: County + score + band */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full shrink-0", BAND_DOT[p.band])} />
                        <span className="text-xs font-semibold">{county}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums text-xs opacity-70">
                          {(p.weight * 100).toFixed(0)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", BAND_CLASSES[p.band])}
                        >
                          {p.band}
                        </Badge>
                      </div>
                    </div>

                    {/* Row 2: Pillar + at-risk count */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-4 text-[11px] opacity-80">
                      <span className="truncate">{pillar} pillar</span>
                      {atRisk !== null && (
                        <span className="shrink-0">{atRisk} at risk</span>
                      )}
                    </div>

                    {/* Row 3: Last field visit */}
                    {visit && (
                      <div className="pl-4 text-[10px]">
                        <span className={cn("font-medium", visit.cls)}>
                          {visit.label}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Pillar view — grouped by Inuka pillar ────────────────── */
            <div className="flex flex-col gap-3 pr-2">
              {pillarEntries.map(([pillar, pillarPoints]) => {
                const maxBand = pillarPoints.reduce<HeatPoint["band"]>(
                  (worst, p) => {
                    const order: HeatPoint["band"][] = ["low", "medium", "high", "critical"];
                    return order.indexOf(p.band) > order.indexOf(worst) ? p.band : worst;
                  },
                  "low",
                );
                const avgScore = Math.round(
                  (pillarPoints.reduce((s, p) => s + p.weight, 0) / pillarPoints.length) * 100,
                );
                const critCount = pillarPoints.filter((p) => p.band === "critical").length;

                return (
                  <div key={pillar} className="rounded-lg border overflow-hidden">
                    {/* Pillar header */}
                    <div
                      className={cn(
                        "flex items-center justify-between px-3 py-2",
                        BAND_CLASSES[maxBand],
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("size-2 shrink-0 rounded-full", BAND_DOT[maxBand])} />
                        <span className="truncate text-xs font-semibold">{pillar} Pillar</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {critCount > 0 && (
                          <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
                            {critCount} critical
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", BAND_CLASSES[maxBand])}
                        >
                          avg {avgScore}
                        </Badge>
                        <span className="text-[10px] opacity-60">{pillarPoints.length} cohorts</span>
                      </div>
                    </div>

                    {/* Cohorts in pillar */}
                    <div className="flex flex-col divide-y">
                      {pillarPoints.map((p) => {
                        const isSelected = p.assetId === selectedAssetId;
                        const meta = assetMap.get(p.assetId);
                        const county = meta?.segment ?? p.assetId;
                        return (
                          <button
                            key={p.assetId}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => onSelect(isSelected ? null : p.assetId)}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none",
                              isSelected && "bg-muted",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn("size-1.5 rounded-full shrink-0", BAND_DOT[p.band])} />
                              <span className="text-xs">{county}</span>
                              {p.band === "critical" && (
                                <span className="text-[10px] text-red-500">⚠ Dropout risk</span>
                              )}
                            </div>
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {(p.weight * 100).toFixed(0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
