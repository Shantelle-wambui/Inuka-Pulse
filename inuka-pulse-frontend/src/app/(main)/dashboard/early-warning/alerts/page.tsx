import { Bell, ShieldAlert, AlertTriangle, Filter } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackendError } from "@/components/backend-error";
import { fetchAlerts } from "@/lib/inuka-pulse/api";
import type { Alert } from "@/lib/inuka-pulse/types";
import { NarrativeAlertCard } from "@/app/(main)/dashboard/inuka/_components/narrative-alert-card";

import { AlertSeverityFilter } from "./_components/alert-severity-filter";

export default async function EarlyWarningAlertsPage() {
  let alerts: Alert[];

  try {
    alerts = (await fetchAlerts()).data;
  } catch {
    return <BackendError message="Unable to load alerts. The backend may be unavailable or the request timed out." />;
  }

  const totalAlerts = alerts.length;
  const activeAlerts = alerts.filter((a) => a.status === "active").length;
  const criticalCount = alerts.filter((a) => a.severity === "Critical").length;
  const highCount = alerts.filter((a) => a.severity === "High").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Bell className="size-6 text-red-600" />
          <h1 className="text-3xl font-bold tracking-tight">Alert Queue</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Real-time beneficiary alerts requiring attention. Each alert is generated when a programme rule detects a risk signal — review, acknowledge, and act before disengagement occurs.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <Bell className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAlerts}</div>
            <p className="text-xs text-muted-foreground">Across all severities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Filter className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts}</div>
            <p className="text-xs text-muted-foreground">Unacknowledged alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <ShieldAlert className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground">Immediate action required</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
            <AlertTriangle className="size-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{highCount}</div>
            <p className="text-xs text-muted-foreground">Escalation recommended</p>
          </CardContent>
        </Card>
      </div>

      {/* Severity filter + alert list */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <CardTitle>Filter by Severity</CardTitle>
          </div>
          <CardDescription>
            Select a severity band to narrow the alert queue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertSeverityFilter alerts={alerts} />
        </CardContent>
      </Card>
    </div>
  );
}
