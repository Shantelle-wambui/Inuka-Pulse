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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react";

interface Program {
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

const PILLARS = ["Scholarship", "Plus", "Vocational", "Tech"];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  planned: "bg-yellow-100 text-yellow-800",
};

const PILLAR_COLORS: Record<string, string> = {
  Scholarship: "bg-purple-100 text-purple-800",
  Plus: "bg-indigo-100 text-indigo-800",
  Vocational: "bg-orange-100 text-orange-800",
  Tech: "bg-cyan-100 text-cyan-800",
};

export default function ProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchPrograms();
  }, [pillarFilter, statusFilter]);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      let url = "/api/v1/programs";
      const params = new URLSearchParams();
      if (pillarFilter !== "all") params.append("pillar", pillarFilter);
      if (statusFilter === "active") params.append("status", "active");
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPrograms(data);
      }
    } catch (error) {
      console.error("Failed to fetch programs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrograms = programs.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.county.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalBeneficiaries = filteredPrograms.reduce(
    (sum, p) => sum + (p.currentEnrollment || 0),
    0,
  );
  const totalFunding = filteredPrograms.reduce(
    (sum, p) => sum + (p.totalFunding || 0),
    0,
  );
  const totalDisbursed = filteredPrograms.reduce(
    (sum, p) => sum + (p.disbursedAmount || 0),
    0,
  );
  const avgUtilization =
    filteredPrograms.length > 0
      ? filteredPrograms.reduce(
          (sum, p) => sum + (p.capacityUtilization || 0),
          0,
        ) / filteredPrograms.length
      : 0;

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
          <h1 className="text-3xl font-bold tracking-tight">
            Programs & Funding
          </h1>
          <p className="text-muted-foreground">
            Manage programs across all pillars and track funding utilization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPrograms}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Programs
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredPrograms.filter((p) => p.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {filteredPrograms.length} total programs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Beneficiaries
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalBeneficiaries.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Across all programs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Funding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalFunding)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalDisbursed)} disbursed (
              {totalFunding > 0
                ? ((totalDisbursed / totalFunding) * 100).toFixed(1)
                : 0}
              %)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Capacity Utilization
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(avgUtilization * 100).toFixed(1)}%
            </div>
            <Progress value={avgUtilization * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search programs..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={pillarFilter} onValueChange={setPillarFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Pillar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pillars</SelectItem>
                {PILLARS.map((pillar) => (
                  <SelectItem key={pillar} value={pillar}>
                    {pillar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Programs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Programs</CardTitle>
          <CardDescription>
            {filteredPrograms.length} programs found
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Enrollment</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                  <TableHead className="text-right">Funding</TableHead>
                  <TableHead>Donors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrograms.map((program) => (
                  <TableRow
                    key={program.programId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/programs/${program.programId}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{program.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {program.cohortCount || 0} cohorts
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={PILLAR_COLORS[program.pillar]}>
                        {program.pillar}
                      </Badge>
                    </TableCell>
                    <TableCell>{program.county}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[program.status]}>
                        {program.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{program.currentEnrollment || 0}</div>
                      <div className="text-xs text-muted-foreground">
                        / {program.targetCapacity}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress
                          value={(program.capacityUtilization || 0) * 100}
                          className="w-16 h-2"
                        />
                        <span className="text-sm">
                          {((program.capacityUtilization || 0) * 100).toFixed(
                            0,
                          )}
                          %
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{formatCurrency(program.totalFunding || 0)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(program.disbursedAmount || 0)} disbursed
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(program.donors || []).slice(0, 2).map((donor, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {donor.split(" ")[0]}
                          </Badge>
                        ))}
                        {(program.donors || []).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{program.donors.length - 2}
                          </Badge>
                        )}
                      </div>
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
