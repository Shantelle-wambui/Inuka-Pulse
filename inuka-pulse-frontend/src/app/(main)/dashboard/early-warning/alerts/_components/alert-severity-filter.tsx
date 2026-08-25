"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { Alert, SeverityBand } from "@/lib/inuka-pulse/types";
import { NarrativeAlertCard } from "@/app/(main)/dashboard/inuka/_components/narrative-alert-card";

const SEVERITIES = ["All", "Critical", "High", "Medium", "Low"] as const;
type FilterOption = (typeof SEVERITIES)[number];

const BADGE_STYLES: Record<FilterOption, { active: string; inactive: string }> = {
  All: {
    active: "bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800",
    inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
  },
  Critical: {
    active: "bg-red-600 text-white hover:bg-red-700",
    inactive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50",
  },
  High: {
    active: "bg-orange-500 text-white hover:bg-orange-600",
    inactive: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50",
  },
  Medium: {
    active: "bg-amber-500 text-white hover:bg-amber-600",
    inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50",
  },
  Low: {
    active: "bg-emerald-600 text-white hover:bg-emerald-700",
    inactive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50",
  },
};

interface AlertSeverityFilterProps {
  alerts: Alert[];
}

export function AlertSeverityFilter({ alerts }: AlertSeverityFilterProps) {
  const [selected, setSelected] = useState<FilterOption>("All");

  const filteredAlerts =
    selected === "All"
      ? alerts
      : alerts.filter((a) => a.severity === selected);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {SEVERITIES.map((severity) => {
          const isActive = selected === severity;
          const styles = BADGE_STYLES[severity];
          const count =
            severity === "All"
              ? alerts.length
              : alerts.filter((a) => a.severity === severity).length;

          return (
            <button
              key={severity}
              type="button"
              onClick={() => setSelected(severity)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full"
            >
              <Badge
                variant="secondary"
                className={`cursor-pointer transition-colors px-3 py-1 text-xs font-medium ${
                  isActive ? styles.active : styles.inactive
                }`}
              >
                {severity} ({count})
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Filtered alert list */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No alerts matching the selected severity.
          </p>
        ) : (
          filteredAlerts.map((alert) => (
            <NarrativeAlertCard key={alert.id} alert={alert} />
          ))
        )}
      </div>
    </div>
  );
}
