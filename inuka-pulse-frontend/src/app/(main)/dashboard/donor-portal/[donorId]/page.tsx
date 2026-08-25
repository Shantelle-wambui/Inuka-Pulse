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
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Heart,
  DollarSign,
  Mail,
  Building2,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface DonorDetail {
  donorId: string;
  name: string;
  type: string;
  contactEmail: string;
  contactPhone?: string;
  isActive: boolean;
}

interface DonorSummaryData {
  totalCommitted: number;
  totalDisbursed: number;
  programsFundedCount: number;
  totalBeneficiariesReached: number;
  avgDisbursementRate: number;
}

interface FundedProgram {
  programId: string;
  programName: string;
  pillar: string;
  county: string;
  amountKes: number;
  disbursedToDate: number;
  fiscalYear: number;
  fundingStatus: string;
  beneficiariesReached: number;
  completionRate: number;
}

const PILLAR_COLORS: Record<string, string> = {
  Scholarship: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Plus: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  Vocational: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Tech: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

const TYPE_COLORS: Record<string, string> = {
  corporate: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  foundation: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  government: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  individual: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

export default function DonorDetailPage() {
  const params = useParams();
  const donorId = params.donorId as string;
  const [donor, setDonor] = useState<DonorDetail | null>(null);
  const [summary, setSummary] = useState<DonorSummaryData | null>(null);
  const [fundedPrograms, setFundedPrograms] = useState<FundedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = document.cookie.match(/inuka-token=([^;]+)/)?.[1];
        const apiBase = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
        const headers: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        const [donorRes, summaryRes, programsRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/donors/${donorId}`, { headers }),
          fetch(`${apiBase}/api/v1/donors/${donorId}/summary`, { headers }),
          fetch(`${apiBase}/api/v1/programs/by-donor/${donorId}`, { headers }),
        ]);

        if (!donorRes.ok) throw new Error(`Failed to load donor (HTTP ${donorRes.status})`);
        setDonor(await donorRes.json());

        if (summaryRes.ok) setSummary(await summaryRes.json());
        if (programsRes.ok) setFundedPrograms(await programsRes.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load donor");
      } finally {
        setLoading(false);
      }
    };

    if (donorId) fetchData();
  }, [donorId]);

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
          <Link href="/dashboard/donor-portal">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Donors
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!donor) return null;

  const disbursementPercent =
    summary && summary.totalCommitted > 0
      ? (summary.totalDisbursed / summary.totalCommitted) * 100
      : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/donor-portal">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-500" />
            {donor.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={TYPE_COLORS[donor.type?.toLowerCase()] ?? "bg-muted"}>
              {donor.type}
            </Badge>
            <Badge variant={donor.isActive ? "default" : "secondary"}>
              {donor.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Contact & Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Contact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{donor.contactEmail}</span>
            </div>
            {donor.contactPhone && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">📞</span>
                <span>{donor.contactPhone}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Committed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Committed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalCommitted ?? 0)}
            </div>
          </CardContent>
        </Card>

        {/* Total Disbursed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Disbursed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalDisbursed ?? 0)}
            </div>
            <Progress value={disbursementPercent} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {disbursementPercent.toFixed(1)}% of committed
            </p>
          </CardContent>
        </Card>

        {/* Programs Funded */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs Funded</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.programsFundedCount ?? fundedPrograms.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funded Programs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Funded Programs</CardTitle>
        </CardHeader>
        <CardContent>
          {fundedPrograms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No funded programs found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Pillar</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Disbursed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundedPrograms.map((fp) => (
                  <TableRow
                    key={fp.programId}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={`/dashboard/programs/${fp.programId}`}
                        className="font-medium hover:underline"
                      >
                        {fp.programName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={PILLAR_COLORS[fp.pillar] ?? "bg-muted"}>
                        {fp.pillar}
                      </Badge>
                    </TableCell>
                    <TableCell>{fp.county}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(fp.amountKes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(fp.disbursedToDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{fp.fundingStatus}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
