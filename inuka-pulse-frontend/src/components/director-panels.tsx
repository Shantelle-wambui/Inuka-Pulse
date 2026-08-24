"use client";

import {
  Phone, Home, MessageSquare, Mail, MoreHorizontal,
  CheckCircle2, XCircle, MessageCircle, AlertTriangle,
  Users, Activity, TrendingUp, ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { InterventionSummary, WelfareSummary } from "@/lib/inuka-pulse/api";

// ── Intervention Summary Panel ────────────────────────────────────────────────

interface InterventionSummaryPanelProps {
  data: InterventionSummary;
}

const OUTCOME_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  reached:      { label: "Reached",        icon: CheckCircle2,   color: "text-green-600 dark:text-green-400" },
  no_answer:    { label: "No answer",       icon: XCircle,        color: "text-muted-foreground" },
  left_message: { label: "Left message",    icon: MessageCircle,  color: "text-amber-600 dark:text-amber-400" },
  escalated:    { label: "Escalated",       icon: AlertTriangle,  color: "text-red-600 dark:text-red-400" },
};

const CONTACT_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  phone_call: { label: "Phone call",  icon: Phone },
  home_visit: { label: "Home visit",  icon: Home },
  sms:        { label: "SMS",         icon: MessageSquare },
  email:      { label: "Email",       icon: Mail },
  other:      { label: "Other",       icon: MoreHorizontal },
};

export function InterventionSummaryPanel({ data }: InterventionSummaryPanelProps) {
  const totalOutcomes = Object.values(data.byOutcome).reduce((a, b) => a + b, 0);
  const reachedCount  = data.byOutcome["reached"] ?? 0;
  const reachRate     = totalOutcomes > 0
    ? `${Math.round((reachedCount / totalOutcomes) * 100)}%`
    : "—";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

      {/* KPI strip */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4" />
            Intervention Activity
          </CardTitle>
          <CardDescription className="text-xs">
            Follow-up actions recorded by Case Managers across all cohorts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Total follow-ups</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">
                {data.totalFollowUps.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Beneficiaries contacted</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5 text-primary">
                {data.uniqueBeneficiariesContacted.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">
                {data.last30Days.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reach rate</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5 text-green-600 dark:text-green-400">
                {reachRate}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By outcome */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="size-4" />
            Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {Object.entries(data.byOutcome).map(([key, count]) => {
            const config = OUTCOME_CONFIG[key];
            if (!config || count === 0) return null;
            const Icon = config.icon;
            const pct = totalOutcomes > 0 ? Math.round((count / totalOutcomes) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <Icon className={`size-3.5 shrink-0 ${config.color}`} />
                <span className="text-sm flex-1">{config.label}</span>
                <span className="text-sm font-semibold tabular-nums">{count}</span>
                <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
              </div>
            );
          })}
          {data.totalFollowUps === 0 && (
            <p className="text-sm text-muted-foreground">No follow-ups recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* By contact type */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="size-4" />
            Contact Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {Object.entries(data.byContactType).map(([key, count]) => {
            const config = CONTACT_CONFIG[key];
            if (!config || count === 0) return null;
            const Icon = config.icon;
            const pct = totalOutcomes > 0 ? Math.round((count / totalOutcomes) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-sm flex-1">{config.label}</span>
                <span className="text-sm font-semibold tabular-nums">{count}</span>
                <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
              </div>
            );
          })}
          {data.totalFollowUps === 0 && (
            <p className="text-sm text-muted-foreground">No follow-ups recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Escalation alert */}
      {data.escalatedCount > 0 && (
        <Card className="md:col-span-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">
              <strong>{data.escalatedCount} follow-up{data.escalatedCount !== 1 ? "s" : ""}</strong> were
              escalated as welfare concerns. Review the open welfare concerns below.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Welfare Summary Card ──────────────────────────────────────────────────────

interface WelfareSummaryCardProps {
  data: WelfareSummary;
}

export function WelfareSummaryCard({ data }: WelfareSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-500" />
          Welfare Concerns
        </CardTitle>
        <CardDescription className="text-xs">
          Welfare concern reports raised by Case Managers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{data.total}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5 text-amber-600 dark:text-amber-400">
              {data.totalOpen}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5 text-green-600 dark:text-green-400">
              {data.totalClosed}
            </p>
          </div>
        </div>
        {data.totalOpen > 0 && (
          <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
            {data.openRate} of welfare concerns are unresolved.
            {data.totalOpen >= 5 && " Review and assign follow-up actions."}
          </p>
        )}
        {data.total === 0 && (
          <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
            No welfare concerns recorded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
