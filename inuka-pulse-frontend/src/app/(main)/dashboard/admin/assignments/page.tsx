"use client";

import { useEffect, useState, useCallback } from "react";
import { UserCog, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  fetchAssignments, fetchCaseManagers, fetchAssignableCohorts,
  createAssignment, deleteAssignment,
  type CohortAssignment, type CaseManagerUser,
} from "@/lib/inuka-pulse/api";

/**
 * Assignment Management Page — /dashboard/admin/assignments
 *
 * Admins can:
 *  - See all current Case Manager ↔ Cohort assignments
 *  - Assign a Case Manager to a cohort
 *  - Remove an assignment
 */
export default function AssignmentsPage() {
  const [assignments, setAssignments]       = useState<CohortAssignment[]>([]);
  const [caseManagers, setCaseManagers]     = useState<CaseManagerUser[]>([]);
  const [cohorts, setCohorts]               = useState<string[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  // Form state
  const [selectedUser, setSelectedUser]     = useState<string>("");
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [saving, setSaving]                 = useState(false);
  const [saveMsg, setSaveMsg]               = useState<string | null>(null);
  const [deletingId, setDeletingId]         = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, cm, c] = await Promise.all([
        fetchAssignments(),
        fetchCaseManagers(),
        fetchAssignableCohorts(),
      ]);
      setAssignments(a);
      setCaseManagers(cm);
      setCohorts(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async () => {
    if (!selectedUser || !selectedCohort) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await createAssignment(Number(selectedUser), selectedCohort);
      setSaveMsg("Assignment created.");
      setSelectedUser("");
      setSelectedCohort("");
      await load();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to create assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignment: CohortAssignment) => {
    if (!confirm(`Remove ${assignment.caseManagerName} from ${assignment.cohortId}?`)) return;
    setDeletingId(assignment.id);
    try {
      await deleteAssignment(assignment.userId, assignment.cohortId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove assignment.");
    } finally {
      setDeletingId(null);
    }
  };

  // Group assignments by cohort for display
  const byCohort: Record<string, CohortAssignment[]> = {};
  for (const a of assignments) {
    if (!byCohort[a.cohortId]) byCohort[a.cohortId] = [];
    byCohort[a.cohortId].push(a);
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="size-6" />
          Assignment Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign Case Managers to cohorts. Each Case Manager can only see
          and act on beneficiaries in their assigned cohorts.
        </p>
      </div>

      {/* ── Assign new ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign a Case Manager</CardTitle>
          <CardDescription className="text-xs">
            Select a Case Manager and a cohort, then click Assign.
            A Case Manager can be assigned to multiple cohorts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Case Manager
              </label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Case Manager…" />
                </SelectTrigger>
                <SelectContent>
                  {caseManagers.length === 0 ? (
                    <SelectItem value="__none__" disabled>No Case Managers found</SelectItem>
                  ) : (
                    caseManagers.map((cm) => (
                      <SelectItem key={cm.id} value={String(cm.id)}>
                        {cm.name} ({cm.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Cohort
              </label>
              <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cohort…" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAssign}
              disabled={saving || !selectedUser || !selectedCohort}
              className="shrink-0"
            >
              {saving ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Assigning…</>
              ) : (
                <><Plus className="size-4 mr-2" /> Assign</>
              )}
            </Button>
          </div>

          {saveMsg && (
            <p className={`text-xs mt-2 flex items-center gap-1 ${saveMsg.includes("created") ? "text-green-600" : "text-destructive"}`}>
              {saveMsg.includes("created")
                ? <CheckCircle2 className="size-3.5" />
                : <AlertTriangle className="size-3.5" />}
              {saveMsg}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Current assignments ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Current Assignments</CardTitle>
              <CardDescription className="text-xs">
                {assignments.length} assignment{assignments.length !== 1 ? "s" : ""} across {Object.keys(byCohort).length} cohort{Object.keys(byCohort).length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">{assignments.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-24 text-destructive text-sm px-4">
              {error}
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm gap-1">
              <UserCog className="size-6 opacity-30" />
              <p>No assignments yet. Use the form above to add one.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(byCohort).sort(([a], [b]) => a.localeCompare(b)).map(([cohortId, rows]) => (
                <div key={cohortId}>
                  {/* Cohort header */}
                  <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
                    <span className="text-xs font-medium font-mono">{cohortId}</span>
                    <Badge variant="outline" className="text-xs">{rows.length} Case Manager{rows.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  {/* Case Managers */}
                  {rows.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{a.caseManagerName}</p>
                        <p className="text-xs text-muted-foreground">{a.caseManagerEmail}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === a.id}
                        onClick={() => handleDelete(a)}
                      >
                        {deletingId === a.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
