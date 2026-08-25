"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { HazardStatusBadge, RiskRatingBadge } from "./risk-rating-badge";

type ReportFilterType = "all" | "escalation" | "near_dropout" | "welfare_concern";

/**
 * Derives a synthetic welfare concern type from a hazard report's fields.
 * - Critical/High severity → 'escalation'
 * - Medium severity with risk/dropout keywords → 'near_dropout'
 * - Low severity or welfare keywords → 'welfare_concern'
 */
function deriveWelfareType(h: any): ReportFilterType {
  const severity = (h.severityEstimate ?? "").toLowerCase();
  const category = (h.category ?? "").toLowerCase();
  const status = (h.status ?? "").toLowerCase();

  if (severity === "critical" || severity === "high") {
    return "escalation";
  }
  if (
    severity === "medium" &&
    (category.includes("risk") ||
      category.includes("dropout") ||
      category.includes("attendance") ||
      category.includes("engagement"))
  ) {
    return "near_dropout";
  }
  if (
    severity === "low" ||
    category.includes("welfare") ||
    category.includes("health") ||
    category.includes("wellbeing") ||
    category.includes("mental")
  ) {
    return "welfare_concern";
  }

  // Default: medium without risk keywords → near_dropout
  if (severity === "medium") {
    return "near_dropout";
  }

  return "welfare_concern";
}

interface HazardFilterTabsProps {
  hazards: any[];
}

export function HazardFilterTabs({ hazards }: HazardFilterTabsProps) {
  const [activeTab, setActiveTab] = useState<ReportFilterType>("all");

  // Enrich hazards with derived welfare type
  const enrichedHazards = useMemo(
    () =>
      hazards.map((h) => ({
        ...h,
        _welfareType: deriveWelfareType(h),
      })),
    [hazards]
  );

  const filteredHazards = useMemo(
    () =>
      activeTab === "all"
        ? enrichedHazards
        : enrichedHazards.filter((h) => h._welfareType === activeTab),
    [enrichedHazards, activeTab]
  );

  const counts = useMemo(() => {
    const c = { all: hazards.length, escalation: 0, near_dropout: 0, welfare_concern: 0 };
    enrichedHazards.forEach((h) => {
      c[h._welfareType as keyof typeof c]++;
    });
    return c;
  }, [enrichedHazards, hazards.length]);

  return (
    <>
      {/* Filter Tabs */}
      <Tabs
        defaultValue="all"
        onValueChange={(val) => setActiveTab(val as ReportFilterType)}
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="escalation">Escalation ({counts.escalation})</TabsTrigger>
          <TabsTrigger value="near_dropout">Near-Dropout ({counts.near_dropout})</TabsTrigger>
          <TabsTrigger value="welfare_concern">Welfare Concern ({counts.welfare_concern})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Hazard List */}
      <Card>
        <CardContent className="p-0">
          {filteredHazards.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No reports match this filter.
            </div>
          ) : (
            <>
              {/* Mobile: stacked */}
              <div className="divide-y sm:hidden">
                {filteredHazards.map((h: any) => (
                  <Link
                    key={h.id}
                    href={`/dashboard/inuka/hazards/${h.id}`}
                    className="block px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{h.siteName}</span>
                      <HazardStatusBadge status={h.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.reportType === "near_miss"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                        }`}
                      >
                        {h.reportType === "near_miss" ? "Escalation" : "Welfare Concern"}
                      </span>
                      <WelfareTypeBadge type={h._welfareType} />
                      <p className="text-xs text-muted-foreground">
                        {h.category} · {h.severityEstimate}
                      </p>
                    </div>
                    {h.riskRating && <RiskRatingBadge rating={h.riskRating} />}
                  </Link>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 text-left">Site</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Concern Type</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Severity</th>
                      <th className="px-4 py-3 text-left">Risk Rating</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Reporter</th>
                      <th className="px-4 py-3 text-right">Date</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredHazards.map((h: any) => (
                      <tr key={h.id} className="group hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{h.siteName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              h.reportType === "near_miss"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                            }`}
                          >
                            {h.reportType === "near_miss" ? "Escalation" : "Welfare Concern"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <WelfareTypeBadge type={h._welfareType} />
                        </td>
                        <td className="px-4 py-3">{h.category}</td>
                        <td className="px-4 py-3">{h.severityEstimate}</td>
                        <td className="px-4 py-3">
                          <RiskRatingBadge rating={h.riskRating} />
                        </td>
                        <td className="px-4 py-3">
                          <HazardStatusBadge status={h.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {h.reporterEmail}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                          {h.createdAt
                            ? new Date(h.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/inuka/hazards/${h.id}`}
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <ArrowUpRight className="size-4 text-muted-foreground" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Small badge to display the derived welfare concern type */
function WelfareTypeBadge({ type }: { type: ReportFilterType }) {
  const config: Record<ReportFilterType, { label: string; className: string }> = {
    all: { label: "", className: "" },
    escalation: {
      label: "Escalation",
      className:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300",
    },
    near_dropout: {
      label: "Near-Dropout",
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300",
    },
    welfare_concern: {
      label: "Welfare Concern",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300",
    },
  };

  if (type === "all") return null;

  const { label, className } = config[type];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
