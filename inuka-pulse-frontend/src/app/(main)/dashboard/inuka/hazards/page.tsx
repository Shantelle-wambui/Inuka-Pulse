import { BackendError } from "@/components/backend-error";
import { HazardReportForm } from "./_components/hazard-report-form";
import { HazardFilterTabs } from "./_components/hazard-filter-tabs";
import { getAuthToken } from "@/server/server-actions";

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";

async function fetchHazards(token?: string) {
  const res = await fetch(`${API_BASE}/api/hazard-reports`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async function HazardsPage() {
  let hazards: any[] = [];
  let error: string | null = null;
  try {
    const token = await getAuthToken();
    hazards = await fetchHazards(token);
  } catch (e: any) {
    error = e.message;
  }

  if (error)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 py-2">
          <h1 className="text-2xl tracking-tight">Welfare & Concern Reports</h1>
          <HazardReportForm />
        </div>
        <BackendError message={error} />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl tracking-tight">Welfare & Concern Reports</h1>
          <p className="text-muted-foreground text-sm">
            {hazards.length} report{hazards.length !== 1 ? "s" : ""} — proactive
            beneficiary welfare and safeguarding channel
          </p>
        </div>
        <div className="shrink-0">
          <HazardReportForm />
        </div>
      </div>

      {/* Client-side filter tabs + hazard list */}
      <HazardFilterTabs hazards={hazards} />
    </div>
  );
}
