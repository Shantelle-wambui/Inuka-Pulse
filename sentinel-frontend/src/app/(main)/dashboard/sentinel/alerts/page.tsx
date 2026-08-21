import { fetchAlerts } from "@/lib/sentinel/api";

import { AlertFeed } from "../_components/alert-feed";

export default async function Page() {
  const alerts = await fetchAlerts();

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Beneficiary Alerts</h1>
        <p className="text-muted-foreground text-sm">
          Full alert history across all cohorts — filterable by pillar, severity, and status. Each alert traces back to the beneficiary data signal and rule that triggered it.
        </p>
      </div>

      <AlertFeed alerts={alerts} />
    </div>
  );
}
