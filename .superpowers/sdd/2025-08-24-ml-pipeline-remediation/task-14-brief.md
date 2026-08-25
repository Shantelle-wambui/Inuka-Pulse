# Task 14: Enhance RiskBandBadge with Confidence (Phase 7, Part 3)

## Files
- Modify: `inuka-pulse-frontend/src/components/risk-band-badge.tsx`

## Interfaces
Current props:
- `band: string`
- `className?: string`

New props (add):
- `confidence?: "High" | "Medium" | "Low"` (optional for backward compatibility)
- `showProbability?: boolean` (optional)
- `probability?: number` (0.0-1.0, optional)

## Context

The current RiskBandBadge only shows the band name. With our new escalation model, we have confidence levels and probabilities. This enhancement lets the badge optionally display:
1. A confidence indicator (dot or icon)
2. The probability percentage

This is backward compatible — existing usages without confidence props continue to work.

## Steps

### Step 1: Update the component

Replace `risk-band-badge.tsx` with enhanced version:

```tsx
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
```

### Step 2: Verify TypeScript compiles

```bash
cd inuka-pulse-frontend && npx tsc --noEmit src/components/risk-band-badge.tsx 2>&1
```

Or check the whole project (will have pre-existing errors from @react-pdf/renderer):
```bash
cd inuka-pulse-frontend && npx tsc --noEmit 2>&1 | grep -E "(risk-band-badge|error TS)" | head -10
```

### Step 3: Commit

```bash
git add src/components/risk-band-badge.tsx
git commit -m "feat(frontend): enhance RiskBandBadge with confidence indicator and probability"
```
