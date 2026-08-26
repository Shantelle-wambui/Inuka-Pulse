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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  TrendingUp,
  Target,
  Award,
  Download,
  RefreshCw,
  Briefcase,
  GraduationCap,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ImpactMetrics {
  totalBeneficiaries: number;
  activeBeneficiaries: number;
  completedBeneficiaries: number;
  completionRate: number;
  completionRateTrend: number;
  employmentRate: number;
  employmentRateTrend: number;
  retentionRate90d: number;
  retentionRateTrend: number;
  avgTimeToCompletion: number;
  costPerBeneficiary: number;
  costPerOutcome: number;
}

interface PillarMetrics {
  pillar: string;
  beneficiaries: number;
  completionRate: number;
  employmentRate: number;
  costPerBeneficiary: number;
}

interface TrendData {
  month: string;
  enrolled: number;
  completed: number;
  employed: number;
  retained: number;
}

interface CountyReach {
  county: string;
  beneficiaries: number;
  completionRate: number;
  growthRate: number;
}

const PILLARS = ["All", "Scholarship", "Plus", "Vocational", "Tech"];

const PILLAR_COLORS: Record<string, string> = {
  Scholarship: "#8b5cf6",
  Plus: "#6366f1",
  Vocational: "#f97316",
  Tech: "#06b6d4",
};

export default function ImpactPage() {
  const [metrics, setMetrics] = useState<ImpactMetrics | null>(null);
  const [pillarMetrics, setPillarMetrics] = useState<PillarMetrics[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [countyReach, setCountyReach] = useState<CountyReach[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPillar, setSelectedPillar] = useState("All");
  const [timeRange, setTimeRange] = useState("12m");

  useEffect(() => {
    fetchAllData();
  }, [selectedPillar, timeRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMetrics(),
        fetchPillarMetrics(),
        fetchTrendData(),
        fetchCountyReach(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const pillarParam = selectedPillar !== "All" ? `&pillar=${selectedPillar}` : "";
      const response = await fetch(`${API_BASE}/api/v1/analytics/impact?timeRange=${timeRange}${pillarParam}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch impact metrics:", error);
    }
  };

  const fetchPillarMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/analytics/impact/by-pillar?timeRange=${timeRange}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setPillarMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch pillar metrics:", error);
    }
  };

  const fetchTrendData = async () => {
    try {
      const pillarParam = selectedPillar !== "All" ? `&pillar=${selectedPillar}` : "";
      const response = await fetch(`${API_BASE}/api/v1/analytics/impact/trends?timeRange=${timeRange}${pillarParam}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setTrendData(data);
      }
    } catch (error) {
      console.error("Failed to fetch trend data:", error);
    }
  };

  const fetchCountyReach = async () => {
    try {
      const pillarParam = selectedPillar !== "All" ? `&pillar=${selectedPillar}` : "";
      const response = await fetch(`${API_BASE}/api/v1/analytics/impact/county-reach?timeRange=${timeRange}${pillarParam}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setCountyReach(data);
      }
    } catch (error) {
      console.error("Failed to fetch county reach:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const TrendIndicator = ({ value, suffix = "%" }: { value: number; suffix?: string }) => {
    const isPositive = value >= 0;
    return (
      <div className={`flex items-center text-xs ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        <span>{Math.abs(value).toFixed(1)}{suffix}</span>
      </div>
    );
  };

  if (loading && !metrics) {
    return (
      <div className="flex justify-center items-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Impact & Reach</h1>
          <p className="text-muted-foreground">
            Track program outcomes, beneficiary reach, and organizational impact
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPillar} onValueChange={setSelectedPillar}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Pillar" />
            </SelectTrigger>
            <SelectContent>
              {PILLARS.map((pillar) => (
                <SelectItem key={pillar} value={pillar}>
                  {pillar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Last 3 Months</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="12m">Last 12 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Beneficiaries</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalBeneficiaries?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.activeBeneficiaries?.toLocaleString() || 0} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {(metrics?.completionRate || 0).toFixed(1)}%
              </span>
              {metrics?.completionRateTrend !== undefined && (
                <TrendIndicator value={metrics.completionRateTrend} />
              )}
            </div>
            <Progress value={metrics?.completionRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employment Rate</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {(metrics?.employmentRate || 0).toFixed(1)}%
              </span>
              {metrics?.employmentRateTrend !== undefined && (
                <TrendIndicator value={metrics.employmentRateTrend} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Within 6 months of completion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">90-Day Retention</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {(metrics?.retentionRate90d || 0).toFixed(1)}%
              </span>
              {metrics?.retentionRateTrend !== undefined && (
                <TrendIndicator value={metrics.retentionRateTrend} />
              )}
            </div>
            <Progress value={metrics?.retentionRate90d || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Cost Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost per Beneficiary</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.costPerBeneficiary || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total program cost / beneficiaries served
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost per Outcome</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.costPerOutcome || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total cost / positive outcomes achieved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Outcome Trends</TabsTrigger>
          <TabsTrigger value="pillars">By Pillar</TabsTrigger>
          <TabsTrigger value="reach">Geographic Reach</TabsTrigger>
        </TabsList>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Outcome Trends Over Time</CardTitle>
              <CardDescription>
                Monthly enrollment, completion, and employment outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="enrolled" 
                      stackId="1"
                      stroke="#6366f1" 
                      fill="#6366f1" 
                      fillOpacity={0.6}
                      name="Enrolled"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="completed" 
                      stackId="2"
                      stroke="#22c55e" 
                      fill="#22c55e" 
                      fillOpacity={0.6}
                      name="Completed"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="employed" 
                      stackId="3"
                      stroke="#f97316" 
                      fill="#f97316" 
                      fillOpacity={0.6}
                      name="Employed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pillars">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Pillar</CardTitle>
              <CardDescription>
                Compare outcomes across program pillars
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pillarMetrics} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="pillar" width={100} />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === "costPerBeneficiary" 
                          ? formatCurrency(Number(value)) 
                          : `${Number(value).toFixed(1)}%`,
                        String(name)
                      ]}
                    />
                    <Legend />
                    <Bar 
                      dataKey="completionRate" 
                      fill="#22c55e" 
                      name="Completion Rate"
                    />
                    <Bar 
                      dataKey="employmentRate" 
                      fill="#6366f1" 
                      name="Employment Rate"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pillar summary cards */}
              <div className="grid gap-4 md:grid-cols-4 mt-6">
                {pillarMetrics.map((pillar) => (
                  <Card key={pillar.pillar}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        <Badge 
                          style={{ 
                            backgroundColor: `${PILLAR_COLORS[pillar.pillar]}20`,
                            color: PILLAR_COLORS[pillar.pillar],
                          }}
                        >
                          {pillar.pillar}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Beneficiaries</span>
                        <span className="font-medium">{pillar.beneficiaries.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-medium">{pillar.completionRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Employment</span>
                        <span className="font-medium">{pillar.employmentRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cost/Beneficiary</span>
                        <span className="font-medium">{formatCurrency(pillar.costPerBeneficiary)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reach">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Reach</CardTitle>
              <CardDescription>
                Beneficiary reach and growth by county
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countyReach.slice(0, 15)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="county" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      yAxisId="left"
                      dataKey="beneficiaries" 
                      fill="#6366f1" 
                      name="Beneficiaries"
                    />
                    <Bar 
                      yAxisId="right"
                      dataKey="completionRate" 
                      fill="#22c55e" 
                      name="Completion Rate %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top growing counties */}
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Fastest Growing Counties</h4>
                <div className="grid gap-2 md:grid-cols-5">
                  {countyReach
                    .sort((a, b) => b.growthRate - a.growthRate)
                    .slice(0, 5)
                    .map((county) => (
                      <Card key={county.county} className="p-3">
                        <div className="font-medium text-sm">{county.county}</div>
                        <div className="flex items-center gap-1 text-green-600">
                          <ArrowUpRight className="h-3 w-3" />
                          <span className="text-sm">{county.growthRate.toFixed(1)}% growth</span>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
