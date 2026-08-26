import { UserCog, AlertCircle } from "lucide-react";
import { BackendError } from "@/components/backend-error";
import { Badge } from "@/components/ui/badge";
import { cachedFetchSiteNameMap } from "@/lib/inuka-pulse/cached-fetches";
import { fetchTechnicians, type TechnicianDto } from "@/lib/inuka-pulse/api";

export default async function TechniciansPage() {
  let technicians: TechnicianDto[] = [];
  let error: string | null = null;
  let siteNames: Record<string, string> = {};

  try {
    const [names, techs] = await Promise.all([
      cachedFetchSiteNameMap(),
      fetchTechnicians(),
    ]);
    siteNames = names;
    technicians = techs;
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : "Failed to load technicians";
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl tracking-tight flex items-center gap-2">
          <UserCog className="size-6" /> Case Managers & Field Officers
        </h1>
        <BackendError message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl tracking-tight flex items-center gap-2">
          <UserCog className="size-6" /> Case Managers & Field Officers
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Field officers, their home stations, and active qualifications.
        </p>
      </div>

      {technicians.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <AlertCircle className="size-10 mb-3 opacity-30" />
          <p className="font-medium">No officers found</p>
          <p className="text-sm">Officers are created when a Field Officer user account is linked to a station.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {technicians.map((tech) => (
            <div key={tech.id} className="rounded-lg border p-4 flex flex-col gap-3">
              <div>
                <p className="font-semibold text-sm">{tech.name ?? `Officer #${tech.id}`}</p>
                <p className="text-xs text-muted-foreground">{tech.email}</p>
              </div>
              {tech.stationHomeId && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Home station:</span>
                  {siteNames[tech.stationHomeId] ?? tech.stationHomeId}
                </div>
              )}
              {tech.qualifications && tech.qualifications.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Qualifications</p>
                  {tech.qualifications.map((q, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-xs">{q}</span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                        Active
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No qualifications on record</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
