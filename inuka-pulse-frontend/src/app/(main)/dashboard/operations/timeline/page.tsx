import { fetchDirectorOverview, fetchAlerts } from '@/lib/inuka-pulse/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackendError } from '@/components/backend-error'
import { Clock, CheckCircle2, AlertTriangle, Activity, Users, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

function getSeverityColor(severity: string, acknowledged?: string | null): string {
  if (acknowledged) return 'bg-green-500'
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-red-500'
    case 'high':
      return 'bg-orange-500'
    case 'medium':
      return 'bg-amber-500'
    case 'low':
      return 'bg-green-500'
    default:
      return 'bg-muted-foreground'
  }
}

function getSeverityBadgeVariant(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'destructive'
    case 'high':
      return 'destructive'
    case 'medium':
      return 'secondary'
    case 'low':
      return 'outline'
    default:
      return 'secondary'
  }
}

export default async function InterventionTimelinePage() {
  try {
    const [overviewResult, alertsResult] = await Promise.allSettled([
      fetchDirectorOverview(),
      fetchAlerts(),
    ])

    const overview =
      overviewResult.status === 'fulfilled' ? overviewResult.value : null
    const alerts =
      alertsResult.status === 'fulfilled' ? alertsResult.value.data : []

    if (!overview) {
      return <BackendError message="Failed to load data" />
    }

    const { interventions } = overview

    const sortedAlerts = [...alerts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Intervention Timeline
          </h1>
          <p className="text-muted-foreground mt-1">
            Track programme interventions and follow-up actions across all
            cohorts. Monitor engagement, escalations, and outcomes in real time.
          </p>
        </div>

        {/* KPI Strip */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Follow-ups
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {interventions.totalFollowUps.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Beneficiaries Contacted
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {interventions.uniqueBeneficiariesContacted.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Last 30 Days
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {interventions.last30Days.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Escalated</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {interventions.escalatedCount.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vertical Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Interventions</CardTitle>
            <CardDescription>
              Timeline of alerts and follow-up actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedAlerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No intervention events to display.
              </p>
            ) : (
              <div className="relative pl-8">
                {/* Vertical line */}
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-6">
                  {sortedAlerts.map((alert) => (
                    <div key={alert.id} className="relative">
                      {/* Event dot */}
                      <div
                        className={cn(
                          'absolute left-[-20px] top-1 size-3 rounded-full border-2 border-background',
                          getSeverityColor(
                            alert.severity,
                            alert.acknowledgedAt
                          )
                        )}
                      />

                      {/* Event content */}
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                        {/* Date/time */}
                        <div className="min-w-[140px] text-xs text-muted-foreground shrink-0">
                          <div>
                            {format(
                              new Date(alert.createdAt),
                              'MMM dd, yyyy'
                            )}
                          </div>
                          <div>
                            {format(new Date(alert.createdAt), 'HH:mm')}
                          </div>
                        </div>

                        {/* Card */}
                        <div className="flex-1 rounded-md border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium leading-none">
                                {alert.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {alert.siteName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant={
                                  getSeverityBadgeVariant(
                                    alert.severity
                                  ) as any
                                }
                              >
                                {alert.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {alert.status}
                              </Badge>
                            </div>
                          </div>
                          {alert.acknowledgedAt && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>
                                Acknowledged{' '}
                                {format(
                                  new Date(alert.acknowledgedAt),
                                  'MMM dd, HH:mm'
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Panels */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* By Outcome */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                By Outcome
              </CardTitle>
              <CardDescription>
                Intervention outcomes breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(interventions.byOutcome).map(
                  ([outcome, count]) => (
                    <div
                      key={outcome}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span className="text-sm">{outcome}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  )
                )}
                {Object.keys(interventions.byOutcome).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No outcome data available.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* By Contact Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                By Contact Type
              </CardTitle>
              <CardDescription>
                Contact method distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(interventions.byContactType).map(
                  ([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span className="text-sm">{type}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  )
                )}
                {Object.keys(interventions.byContactType).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No contact type data available.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  } catch {
    return <BackendError message="Failed to load data" />
  }
}
