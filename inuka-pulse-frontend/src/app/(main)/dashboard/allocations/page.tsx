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
  Users,
  TrendingUp,
  MapPin,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  Brain,
  DollarSign,
  UserCog,
  GraduationCap,
  ArrowRight,
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

interface AllocationRecommendation {
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

interface RegionSummary {
  region: string;
  programs: number;
  totalBeneficiaries: number;
  avgDropoutRisk: number;
  demandGrowth: number;
  fieldOfficerCoverage: number;
  budgetUtilization: number;
}

interface AllocationStats {
  pendingRecommendations: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  avgConfidenceScore: number;
  totalReallocationValue: number;
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  field_officer: "Field Officers",
  training_capacity: "Training Capacity",
  budget: "Budget",
};

const RESOURCE_TYPE_ICONS: Record<string, typeof Users> = {
  field_officer: UserCog,
  training_capacity: GraduationCap,
  budget: DollarSign,
};

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
      const params = new URLSearchParams();
      if (selectedResourceType !== "all") params.append("resourceType", selectedResourceType);
      if (selectedRegion !== "all") params.append("region", selectedRegion);
      
      const response = await fetch(`/api/v1/allocations/recommendations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
    }
  };

  const fetchRegionSummary = async () => {
    try {
      const response = await fetch("/api/v1/allocations/region-summary");
      if (response.ok) {
        const data = await response.json();
        setRegionSummary(data);
      }
    } catch (error) {
      console.error("Failed to fetch region summary:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/v1/allocations/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleApprove = async (recommendation: AllocationRecommendation) => {
    try {
      const response = await fetch(`/api/v1/allocations/${recommendation.id}/approve`, {
        method: "POST",
      });
      if (response.ok) {
        setRecommendations(prev => 
          prev.map(r => r.id === recommendation.id ? { ...r, status: "approved" } : r)
        );
        setApprovalDialog(null);
      }
    } catch (error) {
      console.error("Failed to approve recommendation:", error);
    }
  };

  const handleReject = async (recommendation: AllocationRecommendation) => {
    try {
      const response = await fetch(`/api/v1/allocations/${recommendation.id}/reject`, {
        method: "POST",
      });
      if (response.ok) {
        setRecommendations(prev => 
          prev.map(r => r.id === recommendation.id ? { ...r, status: "rejected" } : r)
        );
        setApprovalDialog(null);
      }
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

  const formatResourceAmount = (type: string, amount: number) => {
    if (type === "budget") return formatCurrency(amount);
    if (type === "training_capacity") return `${amount} slots`;
    return `${amount} officers`;
  };

  const pendingRecommendations = recommendations.filter(r => r.status === "pending");
  const uniqueRegions = [...new Set(recommendations.map(r => r.region))];

  // Prepare radar chart data for selected region
  const selectedRegionData = regionSummary.find(r => r.region === selectedRegion) || regionSummary[0];
  const radarData = selectedRegionData ? [
    { metric: "Demand Growth", value: Math.min(selectedRegionData.demandGrowth * 10, 100) },
    { metric: "FO Coverage", value: selectedRegionData.fieldOfficerCoverage },
    { metric: "Budget Util.", value: selectedRegionData.budgetUtilization },
    { metric: "Dropout Risk", value: 100 - selectedRegionData.avgDropoutRisk * 100 },
    { metric: "Programs", value: Math.min(selectedRegionData.programs * 5, 100) },
  ] : [];

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
                      <TableHead>Program</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-center">Change</TableHead>
                      <TableHead className="text-right">Recommended</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRecommendations.map((rec) => {
                      const Icon = RESOURCE_TYPE_ICONS[rec.resourceType];
                      const isIncrease = rec.changeAmount > 0;
                      return (
                        <TableRow key={rec.id}>
                          <TableCell>
                            <div className="font-medium">{rec.programName}</div>
                            <Badge variant="outline" className="text-xs">
                              {rec.pillar}
                            </Badge>
                          </TableCell>
                          <TableCell>{rec.region}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{RESOURCE_TYPE_LABELS[rec.resourceType]}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatResourceAmount(rec.resourceType, rec.currentAllocation)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`flex items-center justify-center gap-1 ${
                              isIncrease ? "text-green-600" : "text-red-600"
                            }`}>
                              <ArrowRight className="h-4 w-4" />
                              <span>
                                {isIncrease ? "+" : ""}{rec.changePercent.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatResourceAmount(rec.resourceType, rec.recommendedAllocation)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={rec.confidenceScore * 100} 
                                className="w-16 h-2"
                              />
                              <span className="text-sm">
                                {(rec.confidenceScore * 100).toFixed(0)}%
                              </span>
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
                                      Approve or reject this ML-generated recommendation
                                    </DialogDescription>
                                  </DialogHeader>
                                  
                                  <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Program</label>
                                        <p className="text-sm text-muted-foreground">{rec.programName}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Region</label>
                                        <p className="text-sm text-muted-foreground">{rec.region}</p>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-sm font-medium">Recommendation</label>
                                      <div className="flex items-center gap-4 mt-1">
                                        <div className="text-center">
                                          <p className="text-lg font-medium">
                                            {formatResourceAmount(rec.resourceType, rec.currentAllocation)}
                                          </p>
                                          <p className="text-xs text-muted-foreground">Current</p>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                        <div className="text-center">
                                          <p className="text-lg font-medium text-primary">
                                            {formatResourceAmount(rec.resourceType, rec.recommendedAllocation)}
                                          </p>
                                          <p className="text-xs text-muted-foreground">Recommended</p>
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-sm font-medium">Rationale</label>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {rec.rationale}
                                      </p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 pt-2">
                                      <div className="text-center p-3 bg-muted rounded-lg">
                                        <TrendingUp className="h-4 w-4 mx-auto mb-1" />
                                        <p className="text-sm font-medium">{rec.demandForecast}%</p>
                                        <p className="text-xs text-muted-foreground">Demand Growth</p>
                                      </div>
                                      <div className="text-center p-3 bg-muted rounded-lg">
                                        <Users className="h-4 w-4 mx-auto mb-1" />
                                        <p className="text-sm font-medium">{rec.reachForecast}</p>
                                        <p className="text-xs text-muted-foreground">Reach Forecast</p>
                                      </div>
                                      <div className="text-center p-3 bg-muted rounded-lg">
                                        <AlertTriangle className="h-4 w-4 mx-auto mb-1" />
                                        <p className="text-sm font-medium">{(rec.dropoutRisk * 100).toFixed(0)}%</p>
                                        <p className="text-xs text-muted-foreground">Dropout Risk</p>
                                      </div>
                                    </div>
                                  </div>

                                  <DialogFooter>
                                    <Button 
                                      variant="outline" 
                                      onClick={() => handleReject(rec)}
                                    >
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
