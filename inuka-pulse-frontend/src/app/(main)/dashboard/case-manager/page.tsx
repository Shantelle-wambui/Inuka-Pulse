import { ClipboardList, Phone, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Case Manager Dashboard — /dashboard/case-manager
 *
 * Operational view showing the Case Manager's assigned beneficiaries
 * sorted by risk level. Focused on: "Who needs my attention today?"
 *
 * This is a shell — real caseload data will be wired in Phase 5 once
 * the beneficiary predictions API and officer assignment are built.
 */
export default function CaseManagerDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <ClipboardList className="size-7 text-primary" />
          My Caseload
        </h1>
        <p className="text-muted-foreground text-sm">
          Your assigned beneficiaries, sorted by risk level. Focus on high-risk cases first.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My Beneficiaries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">—</p>
            <p className="text-xs text-muted-foreground mt-1">Assigned to you</p>
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
            <p className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">—</p>
            <p className="text-xs text-muted-foreground mt-1">High risk or dropout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="size-4 text-amber-500" />
              Pending Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">—</p>
            <p className="text-xs text-muted-foreground mt-1">No contact this week</p>
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
            <p className="text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">—</p>
            <p className="text-xs text-muted-foreground mt-1">No action needed</p>
          </CardContent>
        </Card>
      </div>

      {/* Priority list placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Priority Beneficiaries</CardTitle>
            <Badge variant="outline" className="text-xs">Sorted by risk</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <ClipboardList className="size-8 opacity-30" />
            <p className="text-sm">Your caseload will appear here once beneficiary data is loaded.</p>
            <p className="text-xs opacity-70">Coming in Phase 5</p>
          </div>
        </CardContent>
      </Card>

      {/* Recent follow-ups placeholder */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Recent Follow-up Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Your recorded follow-ups will appear here — Coming in Phase 5
        </CardContent>
      </Card>
    </div>
  );
}
