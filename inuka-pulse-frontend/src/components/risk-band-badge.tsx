import { cn } from "@/lib/utils";

/**
 * Displays a coloured badge for a predicted risk band.
 * Language is intentionally non-deterministic — the badge shows what the
 * model predicted, not a certainty.
 * 
 * Enhanced to optionally show confidence level and probability.
 */

interface RiskBandBadgeProps {
  band: string;
  className?: string;
  /** Optional confidence level from ML interpretation */
  confidence?: "High" | "Medium" | "Low";
  /** Show probability percentage after band name */
  showProbability?: boolean;
  /** Probability value 0.0-1.0 */
  probability?: number;
}

const BAND_STYLES: Record<string, string> = {
  Active:     "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-300  border-green-200  dark:border-green-800",
  "At-Risk":  "bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300  border-amber-200  dark:border-amber-800",
  Disengaged: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  Dropout:    "bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300    border-red-200    dark:border-red-800",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  High:   "bg-current opacity-100",
  Medium: "bg-current opacity-60",
  Low:    "bg-current opacity-30",
};

export function RiskBandBadge({ 
  band, 
  className,
  confidence,
  showProbability,
  probability,
}: RiskBandBadgeProps) {
  const style = BAND_STYLES[band] ?? "bg-muted text-muted-foreground border-border";
  const probPercent = probability !== undefined ? Math.round(probability * 100) : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style,
        className,
      )}
    >
      {/* Confidence indicator dot */}
      {confidence && (
        <span 
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            CONFIDENCE_STYLES[confidence]
          )}
          title={`${confidence} confidence`}
        />
      )}
      
      {/* Band name */}
      <span>{band}</span>
      
      {/* Optional probability */}
      {showProbability && probPercent !== null && (
        <span className="opacity-70">({probPercent}%)</span>
      )}
    </span>
  );
}
