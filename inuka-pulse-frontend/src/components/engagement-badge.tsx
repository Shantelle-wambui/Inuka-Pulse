"use client";

import { cn } from "@/lib/utils";

export type EngagementBand = "Low" | "Medium" | "High";

interface EngagementBadgeProps {
  score: number;
  band?: EngagementBand;
  /** Show only the numeric score without the band label */
  compact?: boolean;
  className?: string;
}

const BAND_STYLES: Record<EngagementBand, string> = {
  Low: "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400 ring-red-200 dark:ring-red-500/30",
  Medium: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 ring-amber-200 dark:ring-amber-500/30",
  High: "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-400 ring-green-200 dark:ring-green-500/30",
};

const BAND_DOT: Record<EngagementBand, string> = {
  Low: "bg-red-500",
  Medium: "bg-amber-500",
  High: "bg-green-500",
};

/** Derive band from score if not explicitly provided */
function deriveBand(score: number): EngagementBand {
  if (score < 40) return "Low";
  if (score < 70) return "Medium";
  return "High";
}

/**
 * EngagementBadge — displays a 0-100 engagement score with color-coded band.
 *
 * Bands:
 *   Low    = 0–39  (red)
 *   Medium = 40–69 (amber)
 *   High   = 70–100 (green)
 *
 * Usage:
 *   <EngagementBadge score={62} />
 *   <EngagementBadge score={85} band="High" compact />
 */
export function EngagementBadge({ score, band, compact = false, className }: EngagementBadgeProps) {
  const resolvedBand = band ?? deriveBand(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        BAND_STYLES[resolvedBand],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", BAND_DOT[resolvedBand])} />
      <span className="tabular-nums font-semibold">{score}</span>
      {!compact && <span className="font-normal opacity-75">/ 100</span>}
    </span>
  );
}

/**
 * EngagementMeter — a tiny progress bar variant for table cells.
 */
export function EngagementMeter({ score, className }: { score: number; className?: string }) {
  const band = deriveBand(score);
  const barColor = {
    Low: "bg-red-500",
    Medium: "bg-amber-500",
    High: "bg-green-500",
  }[band];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums font-medium text-muted-foreground">{score}</span>
    </div>
  );
}
