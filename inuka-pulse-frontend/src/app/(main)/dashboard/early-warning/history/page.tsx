import { fetchAlerts } from "@/lib/inuka-pulse/api";
import { Alert } from "@/lib/inuka-pulse/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackendError } from "@/components/backend-error";
import { History, Clock, CheckCircle2, Shield } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const severityClasses: Record<string, string> = {
  Critical: "bg-red-500/10 text-red-700 dark:text-red-400",
  High: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  Medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Low: "bg-green-500/10 text-green-700 dark:text-green-400",
};

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "MMM d, yyyy HH:mm");
  } catch {
    return "-";
  }
}

function calculateResolutionTime(
  createdAt: string,
  acknowledgedAt: string | undefined | null
): string {
  if (!acknowledgedAt) return "-";
  try {
    const created = new Date(createdAt).getTime();
    const acknowledged = new Date(acknowledgedAt).getTime();
    const diffMs = acknowledged - created;
    if (isNaN(diffMs) || diffMs < 0) return "-";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;

    if (diffDays > 0) {
      return `${diffDays}d ${remainingHours}h`;
    }
    if (diffHours > 0) {
      return `${diffHours}h`;
    }
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m`;
  } catch {
    return "-";
  }
}

function calculateAvgResolutionTime(alerts: Alert[]): string {
  const alertsWithResolution = alerts.filter(
    (a) => a.acknowledgedAt && a.createdAt
  );
  if (alertsWithResolution.length === 0) return "N/A";

  try {
    const totalMs = alertsWithResolution.reduce((sum, a) => {
      const created = new Date(a.createdAt).getTime();
      const acknowledged = new Date(a.acknowledgedAt!).getTime();
      const diff = acknowledged - created;
      return sum + (isNaN(diff) || diff < 0 ? 0 : diff);
    }, 0);

    const avgMs = totalMs / alertsWithResolution.length;
    const avgHours = Math.floor(avgMs / (1000 * 60 * 60));
    const avgDays = Math.floor(avgHours / 24);
    const remainingHours = avgHours % 24;

    if (avgDays > 0) {
      return `${avgDays}d ${remainingHours}h`;
    }
    if (avgHours > 0) {
      return `${avgHours}h`;
    }
    const avgMinutes = Math.floor(avgMs / (1000 * 60));
    return `${avgMinutes}m`;
  } catch {
    return "N/A";
  }
}

function getMostCommonSeverity(alerts: Alert[]): string {
  if (alerts.length === 0) return "N/A";
  const counts: Record<string, number> = {};
  alerts.forEach((a) => {
    counts[a.severity] = (counts[a.severity] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export default async function AlertHistoryPage() {
  try {
    const allAlerts: Alert[] = (await fetchAlerts()).data;

    let resolvedAlerts = allAlerts.filter(
      (a) => a.status === "acknowledged" || a.status === "resolved"
    );

    let usingFallback = false;
    if (resolvedAlerts.length === 0) {
      resolvedAlerts = allAlerts;
      usingFallback = true;
    }

    // Sort by most recently created first
    const sortedAlerts = [...resolvedAlerts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalResolved = resolvedAlerts.length;
    const avgResolutionTime = calculateAvgResolutionTime(resolvedAlerts);
    const mostCommonSeverity = getMostCommonSeverity(resolvedAlerts);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6" />
            Alert History
          </h1>
          <p className="text-muted-foreground mt-1">
            Archive of resolved and acknowledged alerts with resolution metadata
            and response times.
          </p>
        </div>

        {/* Demo fallback info note */}
        {usingFallback && (
          <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Note:</strong> No resolved or acknowledged alerts found.
              Showing all alerts as a demo fallback.
            </p>
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Resolved
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalResolved}</div>
              <p className="text-xs text-muted-foreground">
                Non-active alerts in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Resolution Time
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgResolutionTime}</div>
              <p className="text-xs text-muted-foreground">
                From creation to acknowledgement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Most Common Severity
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mostCommonSeverity}</div>
              <p className="text-xs text-muted-foreground">
                Most frequent severity band
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Resolved Alerts</CardTitle>
            <CardDescription>
              All previously triggered alerts that have been acknowledged or
              resolved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No alerts to display.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4 font-medium">Severity</th>
                      <th className="pb-3 pr-4 font-medium">Title</th>
                      <th className="pb-3 pr-4 font-medium">Site/Cohort</th>
                      <th className="pb-3 pr-4 font-medium">Created</th>
                      <th className="pb-3 pr-4 font-medium">Resolved</th>
                      <th className="pb-3 pr-4 font-medium">
                        Resolution Time
                      </th>
                      <th className="pb-3 font-medium">Acknowledged By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAlerts.map((alert) => (
                      <tr
                        key={alert.id}
                        className="border-b last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs font-medium",
                              severityClasses[alert.severity] || ""
                            )}
                          >
                            {alert.severity}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {alert.title}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {alert.siteName}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                          {formatDate(alert.createdAt)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                          {formatDate(alert.acknowledgedAt)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                          {calculateResolutionTime(
                            alert.createdAt,
                            alert.acknowledgedAt
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {alert.acknowledgedBy || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    return <BackendError message="Failed to load data" />;
  }
}
