"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building2,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ProgramDetail {
  programId: string;
  pillar: string;
  name: string;
  county: string;
  startDate: string;
  endDate: string | null;
  targetCapacity: number;
  status: string;
  description: string;
  currentEnrollment: number;
  capacityUtilization: number;
  totalFunding: number;
  disbursedAmount: number;
  fundingGap: number;
  cohortCount: number;
  donors: string[];
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  planned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

const PILLAR_COLORS: Record<string, string> = {
  Scholarship: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Plus: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  Vocational: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Tech: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

export default function ProgramDetailPage() {
  const params = useParams();
  const programId = params.programId as string;
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgram = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = document.cookie.match(/inuka-token=([^;]+)/)?.[1];
        const apiBase = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
        const res = await fetch(`${apiBase}/api/v1/programs/${programId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Failed to load program (HTTP ${res.status})`);
        const data = await res.json();
        setProgram(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load program");
      } finally {
        setLoading(false);
      }
    };

    if (programId) fetchProgram();
  }, [programId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

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
          <Link href="/dashboard/programs">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Programs
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!program) return null;

  const enrollmentPercent =
    program.targetCapacity > 0
      ? (program.currentEnrollment / program.targetCapacity) * 100
      : 0;

  const fundingPercent =
    program.totalFunding > 0
      ? (program.disbursedAmount / program.totalFunding) * 100
      : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/programs">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{program.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={PILLAR_COLORS[program.pillar] ?? "bg-muted"}>
              {program.pillar}
            </Badge>
            <Badge className={STATUS_COLORS[program.status] ?? "bg-muted"}>
              {program.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Description & Location */}
        <Card className="md:col-span-2 lg:col-span-3">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{program.county}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {new Date(program.startDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {" — "}
                  {program.endDate
                    ? new Date(program.endDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Ongoing"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{program.cohortCount || 0} cohorts</span>
              </div>
            </div>
            {program.description && (
              <p className="mt-4 text-muted-foreground">{program.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Enrollment Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrollment</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {program.currentEnrollment}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {program.targetCapacity}
              </span>
            </div>
            <Progress value={enrollmentPercent} className="mt-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {enrollmentPercent.toFixed(1)}% of target capacity
            </p>
          </CardContent>
        </Card>

        {/* Funding Breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(program.totalFunding)}</div>
            <Progress value={fundingPercent} className="mt-3" />
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Disbursed</span>
                <span className="font-medium">{formatCurrency(program.disbursedAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Funding Gap</span>
                <span className="font-medium text-destructive">
                  {formatCurrency(program.fundingGap)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Donors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Donors</CardTitle>
          </CardHeader>
          <CardContent>
            {(program.donors || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No donors linked</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {program.donors.map((donor, i) => (
                  <Badge key={i} variant="outline">
                    {donor}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
