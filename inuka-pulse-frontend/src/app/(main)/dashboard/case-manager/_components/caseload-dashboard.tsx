"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Phone, AlertTriangle, CheckCircle2,
  Search, Filter, ChevronRight, RefreshCw, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskBandBadge } from "@/components/risk-band-badge";
import { EngagementMeter } from '@/components/engagement-badge';
import { BAND_DOT_CLASSES } from "@/components/risk-distribution-chart";
import type { BeneficiaryPrediction, CaseloadSummary } from "@/lib/inuka-pulse/api";

interface CaseloadDashboardProps {
  caseload: BeneficiaryPrediction[];
  summary: CaseloadSummary | null;
}

const FEATURE_LABELS: Record<string, string> = {
  attendance_rate_30d:      "Low attendance rate",
  days_since_last_contact:  "Long gap since last contact",
  sessions_attended_30d:    "Low sessions attended",
  field_visit_gap_days:     "Large field visit gap",
  disbursement_delay_days:  "Delayed disbursement",
  missed_disbursements_60d: "Missed disbursements",
  assessment_score_latest:  "Low assessment score",
  assessment_score_trend:   "Declining assessment trend",
  missed_sessions_14d:      "Recent session absences",
  no_contact_visits_90d:    "No-contact visits this quarter",
};

function friendlyFeature(raw: string): string {
  return FEATURE_LABELS[raw.trim()] ?? raw.trim().replace(/_/g, " ");
}

function getEngagementScore(b: BeneficiaryPrediction): number {
  return b.engagementScore ?? Math.round((1 - b.dropoutProb) * 85);
}

export function CaseloadDashboard({ caseload, summary }: CaseloadDashboardProps) {
  const router = useRouter();
  const [search, setSearch]   = useState("");
  const [bandFilter, setBand] = useState("all");
  const [sortBy, setSortBy]   = useState<"risk" | "engagement">("risk");

  const filtered = useMemo(() => {
    const list = caseload.filter((b) => {
      const matchSearch =
        !search ||
        b.beneficiaryId.toLowerCase().includes(search.toLowerCase()) ||
        (b.county ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (b.cohortId ?? "").toLowerCase().includes(search.toLowerCase());
      const matchBand = bandFilter === "all" || b.predictedBand === bandFilter;
      return matchSearch && matchBand;
    });

    if (sortBy === "engagement") {
      list.sort((a, b) => getEngagementScore(a) - getEngagementScore(b));
    }

    return list;
  }, [caseload, search, bandFilter, sortBy]);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardList className="size-7 text-primary" />
            My Caseload
          </h1>
          <p className="text-muted-foreground text-sm">
            Your assigned beneficiaries, sorted by dropout risk. Focus on the top of the list first.
          </p>
        </div>
        {summary?.lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 shrink-0">
            <RefreshCw className="size-3" />
            As of {summary.lastUpdated}
          </div>
        )}
      </div>

      {/* ── No assignment banner ── */}
      {summary && summary.total === 0 && (
        <Card className="border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4 text-sm text-amber-800 dark:text-amber-300">
            You have no beneficiaries assigned yet. Ask your programme coordinator to assign
            you to one or more cohorts.
          </CardContent>
        </Card>
      )}

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="size-4" />
              My Beneficiaries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{summary?.total ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.cohorts?.length
                ? `${summary.cohorts.length} cohort${summary.cohorts.length > 1 ? "s" : ""}`
                : "Assigned to you"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {summary?.needsAttention ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Dropout or disengaged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="size-4 text-amber-500" />
              At-Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {summary?.atRisk ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Warning signs present</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-500" />
              Active & On Track
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">
              {summary?.active ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">No action needed</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Priority beneficiary table ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Priority Beneficiaries</CardTitle>
              <Badge variant="outline" className="text-xs">
                {filtered.length} of {caseload.length}
              </Badge>
            </div>

            {/* Search + filter */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search ID, county, cohort…"
                  className="pl-8 h-8 text-sm w-52"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={bandFilter} onValueChange={setBand}>
                <SelectTrigger className="h-8 text-sm w-36 gap-1">
                  <Filter className="size-3.5" />
                  <SelectValue placeholder="All bands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All bands</SelectItem>
                  <SelectItem value="Dropout">Dropout</SelectItem>
                  <SelectItem value="Disengaged">Disengaged</SelectItem>
                  <SelectItem value="At-Risk">At-Risk</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as "risk" | "engagement")}>
                <SelectTrigger className="h-8 text-sm w-40 gap-1">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="risk">Sort: Risk ↓</SelectItem>
                  <SelectItem value="engagement">Sort: Engagement ↑</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <ClipboardList className="size-6 opacity-30" />
              <p className="text-sm">No beneficiaries match your filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((b) => (
                <button
                  key={b.beneficiaryId}
                  className="w-full text-left px-4 py-3.5 hover:bg-muted/50 transition-colors flex items-start gap-3 group"
                  onClick={() =>
                    router.push(
                      `/dashboard/case-manager/beneficiary/${encodeURIComponent(b.beneficiaryId)}`,
                    )
                  }
                >
                  {/* Risk dot */}
                  <div className="mt-1 shrink-0">
                    <span
                      className={`inline-block size-2.5 rounded-full ${BAND_DOT_CLASSES[b.predictedBand as keyof typeof BAND_DOT_CLASSES] ?? "bg-muted"}`}
                    />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">
                        {b.beneficiaryId}
                      </span>
                      <RiskBandBadge band={b.predictedBand} />
                      <EngagementMeter score={getEngagementScore(b)} className="ml-1" />
                      <span className="text-xs text-muted-foreground tabular-nums ml-auto shrink-0">
                        {b.dropoutProbPct} dropout risk
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {b.county && <span>{b.county}</span>}
                      {b.pillar && <span>{b.pillar}</span>}
                      {b.cohortId && <span className="font-mono">{b.cohortId}</span>}
                    </div>

                    {/* Risk factors */}
                    {b.topFeaturesList && b.topFeaturesList.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-1.5">
                        {b.topFeaturesList.slice(0, 3).map((f) => (
                          <span
                            key={f}
                            className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground"
                          >
                            {friendlyFeature(f)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground/60 border-t pt-3">
        Dropout risk scores are model predictions, not confirmed facts. Use them to prioritise
        outreach — always verify with direct contact before taking action.
      </p>
    </div>
  );
}
