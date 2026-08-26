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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  MapPin,
  Check,
  X,
  RefreshCw,
  Brain,
  DollarSign,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  fetchAllocationRecommendations,
  fetchAllocationRegionSummary,
  fetchAllocationStats,
  approveAllocation,
  rejectAllocation,
  type AllocationRecommendation,
  type AllocationRegionSummary,
  type AllocationStats,
} from "@/lib/inuka-pulse/api";

// Local UI alias — RegionSummary from the backend
type RegionSummary = AllocationRegionSummary;

export default function AllocationsPage() {
  const [recommendations, setRecommendations] = useState<AllocationRecommendation[]>([]);
  const [regionSummary, setRegionSummary] = useState<RegionSummary[]>([]);
  const [stats, setStats] = useState<AllocationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedResourceType, setSelectedResourceType] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [approvalDialog, setApprovalDialog] = useState<AllocationRecommendation | null>(null);

  useEffect(() => {
    fetchAllData();
  }, [selectedResourceType, selectedRegion]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRecommendations(),
        fetchRegionSummary(),
        fetchStats(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const data = await fetchAllocationRecommendations({
        resourceType: selectedResourceType !== "all" ? selectedResourceType : undefined,
        region: selectedRegion !== "all" ? selectedRegion : undefined,
      });
      setRecommendations(data);
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
      setRecommendations([]);
    }
  };

  const fetchRegionSummary = async () => {
    try {
      const data = await fetchAllocationRegionSummary();
      setRegionSummary(data);
    } catch (error) {
      console.error("Failed to fetch region summary:", error);
      setRegionSummary([]);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await fetchAllocationStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      setStats(null);
    }
  };

  const handleApprove = async (recommendation: AllocationRecommendation) => {
    if (!recommendation.id) return;
    try {
      await approveAllocation(recommendation.id);
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recommendation.id ? { ...r, status: "approved" } : r)),
      );
      setApprovalDialog(null);
    } catch (error) {
      console.error("Failed to approve recommendation:", error);
    }
  };

  const handleReject = async (recommendation: AllocationRecommendation) => {
    if (!recommendation.id) return;
    try {
      await rejectAllocation(recommendation.id, "Rejected via dashboard review");
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recommendation.id ? { ...r, status: "rejected" } : r)),
      );
      setApprovalDialog(null);
    } catch (error) {
      console.error("Failed to reject recommendation:", error);
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

  const pendingRecommendations = recommendations.filter((r) => r.status === "pending");
  const uniqueRegions = [...new Set(recommendations.map((r) => r.county))];

  // Prepare radar chart data for selected region
  const selectedRegionData = regionSummary.find((r) => r.region === selectedRegion) || regionSummary[0];
  const radarData = selectedRegionData
    ? [
        { metric: "Demand Growth", value: Math.min(selectedRegionData.demandGrowth * 10, 100) },
        { metric: "FO Coverage", value: selectedRegionData.fieldOfficerCoverage },
        { metric: "Budget Util.", value: selectedRegionData.budgetUtilization },
        { metric: "Dropout Risk", value: 100 - selectedRegionData.avgDropoutRisk * 100 },
        { metric: "Programs", value: Math.min(selectedRegionData.programs * 5, 100) },
      ]
    : [];

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resource Allocations</h1>
          <p className="text-muted-foreground">
            ML-powered recommendations for optimal resource distribution
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Resource Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              <SelectItem value="field_officer">Field Officers</SelectItem>
              <SelectItem value="training_capacity">Training Capacity</SelectItem>
              <SelectItem value="budget">Budget</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[160px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {uniqueRegions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.pendingRecommendations || pendingRecommendations.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Recommendations awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved This Month</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.approvedThisMonth || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Reallocations implemented
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.avgConfidenceScore || 0) * 100).toFixed(0)}%
            </div>
            <Progress value={(stats?.avgConfidenceScore || 0) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reallocation Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.totalReallocationValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending budget movements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">
            Recommendations
            {pendingRecommendations.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingRecommendations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="regions">Regional Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>ML Allocation Recommendations</CardTitle>
              <CardDescription>
                Based on demand forecasts, reach projections, and dropout risk analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingRecommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending recommendations at this time.</p>
                  <p className="text-sm">All allocations are optimally distributed.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>County</TableHead>
                      <TableHead>Pillar</TableHead>
                      <TableHead>Rationale</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRecommendations.map((rec, idx) => {
                      const priority = rec.priorityScore ?? 0;
                      return (
                        <TableRow key={rec.id ?? `${rec.county}-${rec.pillar}-${idx}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{rec.county}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {rec.pillar ? (
                              <Badge variant="outline" className="text-xs">
                                {rec.pillar}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <span className="text-sm text-muted-foreground line-clamp-2">
                              {rec.rationale}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(priority, 100)} className="w-16 h-2" />
                              <span className="text-sm font-medium">{priority.toFixed(0)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setApprovalDialog(rec)}
                                  >
                                    Review
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle>Review Allocation Recommendation</DialogTitle>
                                    <DialogDescription>
                                      Approve or reject this Model 5 recommendation
                                    </DialogDescription>
                                  </DialogHeader>

                                  <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">County</label>
                                        <p className="text-sm text-muted-foreground">{rec.county}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Pillar</label>
                                        <p className="text-sm text-muted-foreground">{rec.pillar ?? "—"}</p>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-sm font-medium">Priority Score</label>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Progress value={Math.min(priority, 100)} className="h-2" />
                                        <span className="text-sm font-medium">{priority.toFixed(1)}</span>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-sm font-medium">Rationale</label>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {rec.rationale}
                                      </p>
                                    </div>

                                    {rec.components && Object.keys(rec.components).length > 0 && (
                                      <div>
                                        <label className="text-sm font-medium">Score Breakdown</label>
                                        <div className="mt-1 space-y-1">
                                          {Object.entries(rec.components).map(([key, value]) => (
                                            <div key={key} className="flex justify-between text-sm">
                                              <span className="text-muted-foreground capitalize">
                                                {key.replace(/_/g, " ")}
                                              </span>
                                              <span className="font-medium">{value.toFixed(2)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => handleReject(rec)}>
                                      <X className="h-4 w-4 mr-2" />
                                      Reject
                                    </Button>
                                    <Button onClick={() => handleApprove(rec)}>
                                      <Check className="h-4 w-4 mr-2" />
                                      Approve
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regions">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Regional Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Regional Performance Comparison</CardTitle>
                <CardDescription>
                  Key metrics across all regions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionSummary} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="region" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        dataKey="fieldOfficerCoverage" 
                        fill="#6366f1" 
                        name="FO Coverage %"
                      />
                      <Bar 
                        dataKey="budgetUtilization" 
                        fill="#22c55e" 
                        name="Budget Util. %"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Regional Radar Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Regional Health Analysis</CardTitle>
                <CardDescription>
                  Multi-dimensional view of regional performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis domain={[0, 100]} />
                      <Radar
                        name="Performance"
                        dataKey="value"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Region Detail Cards */}
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            {regionSummary.slice(0, 6).map((region) => (
              <Card key={region.region}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{region.region}</CardTitle>
                    <Badge variant={region.avgDropoutRisk > 0.3 ? "destructive" : "secondary"}>
                      {(region.avgDropoutRisk * 100).toFixed(0)}% risk
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Programs</span>
                    <span className="font-medium">{region.programs}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Beneficiaries</span>
                    <span className="font-medium">{region.totalBeneficiaries.toLocaleString()}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">FO Coverage</span>
                      <span className="font-medium">{region.fieldOfficerCoverage.toFixed(0)}%</span>
                    </div>
                    <Progress value={region.fieldOfficerCoverage} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Budget Utilization</span>
                      <span className="font-medium">{region.budgetUtilization.toFixed(0)}%</span>
                    </div>
                    <Progress value={region.budgetUtilization} className="h-2" />
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <TrendingUp className={`h-4 w-4 ${region.demandGrowth > 0 ? "text-green-600" : "text-red-600"}`} />
                    <span className={region.demandGrowth > 0 ? "text-green-600" : "text-red-600"}>
                      {region.demandGrowth > 0 ? "+" : ""}{region.demandGrowth.toFixed(1)}% demand growth
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
