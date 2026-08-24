import { fetchMyCaseload, fetchMyCaseloadSummary } from "@/lib/inuka-pulse/api";
import { CaseloadDashboard } from "./_components/caseload-dashboard";

/**
 * Case Manager Dashboard — /dashboard/case-manager
 *
 * Server Component: fetches the logged-in officer's caseload and summary
 * in parallel, then passes them to the interactive CaseloadDashboard
 * client component (which handles search/filter/navigation).
 *
 * Data is scoped server-side to the officer's assigned cohorts via JWT.
 */
export default async function CaseManagerDashboardPage() {
  const [caseloadResult, summaryResult] = await Promise.allSettled([
    fetchMyCaseload(),
    fetchMyCaseloadSummary(),
  ]);

  const caseload = caseloadResult.status === "fulfilled" ? caseloadResult.value : [];
  const summary  = summaryResult.status  === "fulfilled" ? summaryResult.value  : null;

  return <CaseloadDashboard caseload={caseload} summary={summary} />;
}
