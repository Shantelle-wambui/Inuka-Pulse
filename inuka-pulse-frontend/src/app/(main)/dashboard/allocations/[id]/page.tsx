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
  Brain,
  MapPin,
  Building2,
  DollarSign,
  Loader2,
  AlertCircle,
  Check,
  X,
} from "lucide-react";

interface AllocationDetail {
  id: string;
  programId: string;
  programName: string;
  pillar: string;
  region: string;
  resourceType: "field_officer" | "training_capacity" | "budget";
  currentAllocation: number;
  recommendedAllocation: number;
  changeAmount: number;
  changePercent: number;
  confidenceScore: number;
  rationale: string;
  demandForecast: number;
  reachForecast: number;
  dropoutRisk: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const RESOURCE_LABELS: Record<string, string> = {
  field_officer: "Field Officer",
  training_capacity: "Training Capacity",
  budget: "Budget",
};

const RESOURCE_ICONS: Record<string, string> = {
  field_officer: "👤",
  training_capacity: "📚",
  budget: "💰",
};

export default function AllocationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [allocation, setAllocation] = useState<AllocationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | null>(null);

  const fetchAllocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = document.cookie.match(/inuka-token=([^;]+)/)?.[1];
      const apiBase = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/v1/allocations/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to load allocation (HTTP ${res.status})`);
      setAllocation(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load allocation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchAllocation();
  }, [id]);

  const handleAction = async (action: "approve" | "reject") => {
    setActionLoading(action);
    try {
      const token = document.cookie.match(/inuka-token=([^;]+)/)?.[1];
      const apiBase = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/v1/allocations/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Failed to ${action} allocation (HTTP ${res.status})`);
      const updated = await res.json();
      setAllocation(updated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : `Failed to ${action} allocation`);
    } finally {
      setActionLoading(null);
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
          <Link href="/dashboard/allocations">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Allocations
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!allocation) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/allocations">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Resource Allocation
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={STATUS_COLORS[allocation.status]}>
              {allocation.status}
            </Badge>
            <Badge variant="outline">
              {RESOURCE_ICONS[allocation.resourceType]}{" "}
              {RESOURCE_LABELS[allocation.resourceType] ?? allocation.resourceType}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Allocation Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Allocation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Program</p>
                  <p className="font-medium">{allocation.programName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Region</p>
                  <p className="font-medium">{allocation.region}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Pillar</p>
                <p className="font-medium">{allocation.pillar}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p className="font-medium">
                  {new Date(allocation.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Amounts */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-muted-foreground text-xs">Current</p>
                  <p className="text-lg font-bold">{allocation.currentAllocation}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Recommended</p>
                  <p className="text-lg font-bold text-primary">
                    {allocation.recommendedAllocation}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Change</p>
                  <p
                    className={`text-lg font-bold ${
                      allocation.changeAmount > 0
                        ? "text-green-600"
                        : allocation.changeAmount < 0
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {allocation.changeAmount > 0 ? "+" : ""}
                    {allocation.changeAmount} ({allocation.changePercent.toFixed(1)}%)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Justification & ML Signals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Justification & Signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Rationale</p>
              <p className="font-medium leading-relaxed">{allocation.rationale}</p>
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground text-xs">Confidence Score</p>
                <p className="font-bold text-lg">
                  {(allocation.confidenceScore * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Dropout Risk</p>
                <p className="font-bold text-lg text-orange-600">
                  {(allocation.dropoutRisk * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Demand Forecast</p>
                <p className="font-bold">{allocation.demandForecast}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Reach Forecast</p>
                <p className="font-bold">{allocation.reachForecast}</p>
              </div>
            </div>

            {/* Action buttons */}
            {allocation.status === "pending" && (
              <div className="border-t pt-4 flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => handleAction("approve")}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "approve" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleAction("reject")}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "reject" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>
            )}

            {allocation.status === "approved" && (
              <div className="border-t pt-4 flex items-center gap-2 text-green-600 text-sm">
                <Check className="h-4 w-4" />
                <span>This allocation has been approved.</span>
              </div>
            )}

            {allocation.status === "rejected" && (
              <div className="border-t pt-4 flex items-center gap-2 text-red-600 text-sm">
                <X className="h-4 w-4" />
                <span>This allocation has been rejected.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
