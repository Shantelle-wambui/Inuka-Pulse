"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Users,
  DollarSign,
  TrendingUp,
  Download,
  RefreshCw,
  Building2,
  Calendar,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  fetchDonors,
  fetchDonorSummary,
  fetchDonorTrends,
  type DonorDto,
  type DonorSummaryDto,
  type FundedProgramSummary,
  type DisbursementTrend,
} from "@/lib/inuka-pulse/api";

const PILLAR_COLORS: Record<string, string> = {
  Scholarship: "#8b5cf6",
  Plus: "#6366f1",
  Vocational: "#f97316",
  Tech: "#06b6d4",
};

const PIE_COLORS = ["#8b5cf6", "#6366f1", "#f97316", "#06b6d4"];

export default function DonorPortalPage() {
  const [donors, setDonors] = useState<DonorDto[]>([]);
  const [selectedDonor, setSelectedDonor] = useState<string>("all");
  const [summary, setSummary] = useState<DonorSummaryDto | null>(null);
  const [disbursementTrends, setDisbursementTrends] = useState<DisbursementTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState<string>("2026");

  useEffect(() => {
    fetchDonorList();
  }, []);

  useEffect(() => {
    if (selectedDonor && selectedDonor !== "all") {
      fetchSummary();
      fetchTrends();
    } else {
      setSummary(null);
      setDisbursementTrends([]);
      setLoading(false);
    }
  }, [selectedDonor, fiscalYear]);

  const fetchDonorList = async () => {
    try {
      const data = await fetchDonors();
      setDonors(data);
      if (data.length > 0) {
        setSelectedDonor(data[0].donorId);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch donors:", error);
      setDonors([]);
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await fetchDonorSummary(selectedDonor);
      setSummary(data);
    } catch (error) {
      console.error("Failed to fetch donor summary:", error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const data = await fetchDonorTrends(selectedDonor, Number(fiscalYear));
      setDisbursementTrends(data);
    } catch (error) {
      console.error("Failed to fetch disbursement trends:", error);
      setDisbursementTrends([]);
    }
  };

  const currentDonor = donors.find((d) => d.donorId === selectedDonor);
  const fundedPrograms: FundedProgramSummary[] = summary?.programs ?? [];

  // Aggregated KPIs. For a selected donor use the summary DTO; for "all" aggregate the donor list.
  const totalFunding =
    selectedDonor === "all"
      ? donors.reduce((sum, d) => sum + (d.totalCommitment || 0), 0)
      : summary?.totalCommitment ?? currentDonor?.totalCommitment ?? 0;
  const totalDisbursed =
    selectedDonor === "all"
      ? donors.reduce((sum, d) => sum + (d.totalDisbursed || 0), 0)
      : summary?.totalDisbursed ?? currentDonor?.totalDisbursed ?? 0;
  const totalBeneficiaries =
    selectedDonor === "all" ? 0 : summary?.totalBeneficiariesReached ?? 0;
  const programCount =
    selectedDonor === "all"
      ? donors.reduce((sum, d) => sum + (d.fundedProgramCount || 0), 0)
      : summary?.totalFundedPrograms ?? currentDonor?.fundedProgramCount ?? 0;

  const disbursementRate = totalFunding > 0 ? (totalDisbursed / totalFunding) * 100 : 0;

  // Pillar distribution for pie chart — prefer the backend's pillarBreakdown
  const pillarDistribution =
    summary?.pillarBreakdown?.map((p) => ({ pillar: p.pillar, value: p.totalFunding })) ??
    fundedPrograms.reduce(
      (acc, p) => {
        const existing = acc.find((a) => a.pillar === p.pillar);
        if (existing) {
          existing.value += p.fundingAmount;
        } else {
          acc.push({ pillar: p.pillar, value: p.fundingAmount });
        }
        return acc;
      },
      [] as { pillar: string; value: number }[],
    );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Donor Portal</h1>
          <p className="text-muted-foreground">
            Track funding utilization, program impact, and beneficiary reach
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedDonor} onValueChange={setSelectedDonor}>
            <SelectTrigger className="w-[200px]">
              <Heart className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select Donor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Donors</SelectItem>
              {donors.map((donor) => (
                <SelectItem key={donor.donorId} value={donor.donorId}>
                  {donor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fiscalYear} onValueChange={setFiscalYear}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Fiscal Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">FY 2026</SelectItem>
              <SelectItem value="2025">FY 2025</SelectItem>
              <SelectItem value="2024">FY 2024</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Committed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalFunding)}</div>
            <p className="text-xs text-muted-foreground">
              For FY {fiscalYear}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disbursed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDisbursed)}</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={disbursementRate} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">
                {disbursementRate.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs Funded</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{programCount}</div>
            <p className="text-xs text-muted-foreground">
              Across {pillarDistribution.length} pillars
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beneficiaries Reached</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBeneficiaries.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalFunding > 0 
                ? `${formatCurrency(totalFunding / Math.max(totalBeneficiaries, 1))} per beneficiary`
                : "N/A"
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Pillar Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Funding by Pillar</CardTitle>
            <CardDescription>Distribution of committed funds across program pillars</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pillarDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="pillar"
                    label={({ payload, percent }) => 
                      `${payload?.pillar || ''} (${((percent || 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {pillarDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PILLAR_COLORS[entry.pillar] || PIE_COLORS[index % PIE_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Disbursement Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Disbursement Trends</CardTitle>
            <CardDescription>Monthly disbursement vs committed amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={disbursementTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" />
                  <YAxis 
                    tickFormatter={(value) => 
                      `${(Number(value) / 1000000).toFixed(0)}M`
                    } 
                  />
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Legend />
                  <Bar dataKey="committed" fill="#6366f1" name="Committed" />
                  <Bar dataKey="disbursed" fill="#22c55e" name="Disbursed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funded Programs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Funded Programs</CardTitle>
          <CardDescription>
            Detailed view of all programs receiving funding
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Pillar</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Disbursed</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead className="text-right">Beneficiaries</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fundedPrograms.map((program) => {
                  const utilization =
                    program.fundingAmount > 0
                      ? (program.disbursedAmount / program.fundingAmount) * 100
                      : 0;
                  return (
                    <TableRow key={program.programId}>
                      <TableCell>
                        <div className="font-medium">{program.programName}</div>
                        <div className="text-xs text-muted-foreground">
                          {program.completionRate?.toFixed(0) ?? 0}% completion
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: `${PILLAR_COLORS[program.pillar]}20`,
                            color: PILLAR_COLORS[program.pillar],
                            borderColor: PILLAR_COLORS[program.pillar],
                          }}
                          variant="outline"
                        >
                          {program.pillar}
                        </Badge>
                      </TableCell>
                      <TableCell>{program.county}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(program.fundingAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(program.disbursedAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={utilization} className="w-16 h-2" />
                          <span className="text-sm">{utilization.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {program.beneficiariesServed?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell>
                        <Badge variant={program.status === "active" ? "default" : "secondary"}>
                          {program.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
