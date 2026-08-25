"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MockDataBannerProps {
  /** Human-readable reason for why mock data is being displayed */
  reason?: string;
  /** Whether to show the banner — hide when isMock is false */
  show: boolean;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Warning banner displayed when mock/demo data is being shown instead of real data.
 * 
 * IMPORTANT: This banner should be displayed prominently whenever the API returns
 * mock data, so programme officers know they're not looking at real predictions.
 * 
 * Usage:
 *   const { data, isMock, mockReason } = await fetchRiskSummary();
 *   return (
 *     <>
 *       <MockDataBanner show={isMock} reason={mockReason} />
 *       <RiskDashboard data={data} />
 *     </>
 *   );
 */
export function MockDataBanner({ reason, show, className }: MockDataBannerProps) {
  if (!show) return null;

  return (
    <Alert variant="default" className={`border-amber-500 bg-amber-50 dark:bg-amber-950/30 ${className ?? ""}`}>
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-300">
        Demo Data
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-400">
        {reason ?? "Showing demo data — real predictions are not yet available."}
        {" "}
        <span className="font-medium">
          Do not use this data for programme decisions.
        </span>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Compact inline badge for mock data indicator.
 * Use in table headers or card titles where a full banner is too intrusive.
 */
export function MockDataBadge({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      <AlertTriangle className="size-3" />
      Demo
    </span>
  );
}
