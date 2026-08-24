"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Wrench,
  User,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface WorkOrderDetail {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "completed" | "verified";
  priority: "low" | "medium" | "high" | "critical";
  siteId: string;
  siteName?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  capaId?: string;
}

const STATUS_VARIANTS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  verified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const PRIORITY_VARIANTS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_TRANSITIONS: Record<string, { next: string; label: string }> = {
  open: { next: "in_progress", label: "Start Work" },
  in_progress: { next: "completed", label: "Mark Completed" },
  completed: { next: "verified", label: "Verify" },
};

export default function WorkOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchWorkOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = document.cookie.match(/inuka-token=([^;]+)/)?.[1];
      const apiBase = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/work-orders/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to load work order (HTTP ${res.status})`);
      setWorkOrder(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load work order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchWorkOrder();
  }, [id]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!workOrder) return;
    setUpdating(true);
    try {
      const token = document.cookie.match(/inuka-token=([^;]+)/)?.[1];
      const apiBase = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/work-orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`Failed to update status (HTTP ${res.status})`);
      const updated = await res.json();
      setWorkOrder(updated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/dashboard/maintenance/work-orders">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Field Visits
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!workOrder) return null;

  const transition = STATUS_TRANSITIONS[workOrder.status];

  return (
    <div className="space-y-6 p-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/maintenance/work-orders">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            {workOrder.title}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={STATUS_VARIANTS[workOrder.status]}>
              {workOrder.status.replace("_", " ")}
            </Badge>
            <Badge className={PRIORITY_VARIANTS[workOrder.priority]}>
              {workOrder.priority} priority
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {workOrder.description && (
              <div>
                <span className="text-muted-foreground">Description</span>
                <p className="mt-1 font-medium">{workOrder.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Site</p>
                  <p className="font-medium">{workOrder.siteName ?? workOrder.siteId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Assigned To</p>
                  <p className="font-medium">
                    {workOrder.assignedTechnicianName ?? workOrder.assignedTechnicianId ?? "Unassigned"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Due Date</p>
                  <p className="font-medium">
                    {workOrder.dueDate
                      ? new Date(workOrder.dueDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "No due date"}
                  </p>
                </div>
              </div>
              {workOrder.capaId && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Linked Intervention</p>
                    <p className="font-mono text-xs font-medium">{workOrder.capaId}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timestamps & Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Timeline & Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium">
                    {new Date(workOrder.createdAt).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Last Updated</p>
                  <p className="font-medium">
                    {new Date(workOrder.updatedAt).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Workflow */}
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                Workflow
              </p>
              <div className="flex items-center gap-2 text-xs">
                {["open", "in_progress", "completed", "verified"].map((s, i) => (
                  <span key={s} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                    <Badge
                      className={
                        s === workOrder.status
                          ? STATUS_VARIANTS[s]
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {s.replace("_", " ")}
                    </Badge>
                  </span>
                ))}
              </div>

              {transition && (
                <Button
                  className="mt-4 w-full"
                  onClick={() => handleStatusUpdate(transition.next)}
                  disabled={updating}
                >
                  {updating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {transition.label}
                </Button>
              )}

              {workOrder.status === "verified" && (
                <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>This field visit has been verified and completed.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
