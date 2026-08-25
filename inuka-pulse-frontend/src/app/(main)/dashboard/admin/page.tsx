"use client";

import { useState } from "react";
import { Database, RefreshCw, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
const getToken = () => document.cookie.match(/inuka-token=([^;]+)/)?.[1];

export default function AdminUtilitiesPage() {
  const [etlLoading, setEtlLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthData, setHealthData] = useState<Record<string, unknown> | null>(null);

  const triggerEtl = async () => {
    setEtlLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/config/etl/trigger`, {
        method: "POST",
        headers: {
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.text();
      toast.success(data || "ETL reload triggered successfully.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`ETL trigger failed: ${msg}`);
    } finally {
      setEtlLoading(false);
    }
  };

  const refreshMetrics = async () => {
    setMetricsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/refresh-metrics`, {
        method: "POST",
        headers: {
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Metrics cache refreshed successfully.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Metrics refresh failed: ${msg}`);
    } finally {
      setMetricsLoading(false);
    }
  };

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealthData(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/health`, {
        method: "GET",
        headers: {
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealthData(data);
      toast.success("System is healthy.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Health check failed: ${msg}`);
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Utilities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System maintenance actions for administrators
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Manual ETL Trigger */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="size-5 text-blue-600" />
              <CardTitle className="text-base">Trigger ETL Reload</CardTitle>
            </div>
            <CardDescription>
              Force the backend to re-read live_batch.json and process new predictions immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={triggerEtl} disabled={etlLoading} className="w-full">
              {etlLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Running…
                </>
              ) : (
                "Run ETL Now"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Refresh Metrics */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="size-5 text-green-600" />
              <CardTitle className="text-base">Refresh Metrics Cache</CardTitle>
            </div>
            <CardDescription>
              Recalculate all dashboard metrics, KPIs, and risk scores from current data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refreshMetrics} disabled={metricsLoading} className="w-full">
              {metricsLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Refreshing…
                </>
              ) : (
                "Refresh Now"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: System Health */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="size-5 text-red-500" />
              <CardTitle className="text-base">System Health</CardTitle>
            </div>
            <CardDescription>
              Check backend connectivity and service status.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={checkHealth} disabled={healthLoading} className="w-full">
              {healthLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Checking…
                </>
              ) : (
                "Check Health"
              )}
            </Button>
            {healthData && (
              <div className="rounded-md border bg-muted/50 p-3 text-xs font-mono space-y-1">
                {Object.entries(healthData).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-semibold truncate max-w-[60%] text-right">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
