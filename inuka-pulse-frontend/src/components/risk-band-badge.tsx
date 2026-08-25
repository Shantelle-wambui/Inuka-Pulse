import { cn } from "@/lib/utils";

/**
 * Displays a coloured badge for a predicted risk band.
 * Language is intentionally non-deterministic — the badge shows what the
 * model predicted, not a certainty.
 */

interface RiskBandBadgeProps {
  band: string;
  className?: string;
}

const BAND_STYLES: Record<string, string> = {
  Active:     "bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-300  border-green-200  dark:border-green-800",
  "At-Risk":  "bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300  border-amber-200  dark:border-amber-800",
  Disengaged: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  Dropout:    "bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300    border-red-200    dark:border-red-800",
};

export function RiskBandBadge({ band, className }: RiskBandBadgeProps) {
  const style = BAND_STYLES[band] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style,
        className,
      )}
    >
      {band}
    </span>
  );
}
