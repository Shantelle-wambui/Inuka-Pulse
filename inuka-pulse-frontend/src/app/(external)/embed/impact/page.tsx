"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, MapPin, GraduationCap, TrendingUp, Building2, Briefcase } from "lucide-react";

/**
 * Public Impact Widget
 * 
 * Embeddable widget showing Inuka Foundation's impact metrics.
 * Designed for iframe embedding on the public website.
 * 
 * Features:
 * - No authentication required
 * - No PII displayed
 * - Auto-refreshes every 5 minutes
 * - Responsive design for various embed sizes
 */

interface ImpactSummary {
  totalReach: number;
  reachByPillar: Record<string, number>;
  countiesCovered: number;
  overallCompletionRate: number;
  employmentRate: number;
  activePrograms: number;
  lastUpdated: string;
}

interface PillarSummary {
  pillar: string;
  programCount: number;
  beneficiariesReached: number;
  completionRate: number;
}

const PILLAR_COLORS: Record<string, string> = {
  Scholarship: "bg-blue-500",
  Plus: "bg-emerald-500",
  Vocational: "bg-amber-500",
  Tech: "bg-purple-500",
};

const PILLAR_ICONS: Record<string, React.ReactNode> = {
  Scholarship: <GraduationCap className="h-5 w-5" />,
  Plus: <TrendingUp className="h-5 w-5" />,
  Vocational: <Building2 className="h-5 w-5" />,
  Tech: <Briefcase className="h-5 w-5" />,
};

export default function PublicImpactWidget() {
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [pillars, setPillars] = useState<Record<string, PillarSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [impactRes, pillarsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/public/impact-summary`),
          fetch(`${API_BASE}/api/v1/public/pillars`),
        ]);

        if (!impactRes.ok || !pillarsRes.ok) {
          throw new Error("Failed to fetch impact data");
        }

        const impactData = await impactRes.json();
        const pillarsData = await pillarsRes.json();

        setImpact(impactData);
        setPillars(pillarsData);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch impact data:", err);
        setError("Unable to load impact data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [API_BASE]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-emerald-600 text-lg">
          Loading impact data...
        </div>
      </div>
    );
  }

  if (error || !impact) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-red-600 text-center">
          <p className="font-semibold">Unable to load data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const totalPillarReach = Object.values(impact.reachByPillar).reduce(
    (sum, val) => sum + val,
    0
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-emerald-800">
          Inuka Foundation Impact
        </h1>
        <p className="text-emerald-600 mt-2">
          Transforming lives across Kenya through education and employment
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-800">
                  {impact.totalReach.toLocaleString()}
                </p>
                <p className="text-sm text-emerald-600">Lives Impacted</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-800">
                  {impact.countiesCovered}
                </p>
                <p className="text-sm text-blue-600">Counties</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <GraduationCap className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-800">
                  {impact.overallCompletionRate}%
                </p>
                <p className="text-sm text-amber-600">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Briefcase className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-800">
                  {impact.employmentRate}%
                </p>
                <p className="text-sm text-purple-600">Employment Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pillar Breakdown */}
      <Card className="border-emerald-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-emerald-800">Impact by Program Pillar</CardTitle>
          <CardDescription>
            Reach across our four core program pillars
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(impact.reachByPillar).map(([pillar, reach]) => {
            const percentage = totalPillarReach > 0 
              ? Math.round((reach / totalPillarReach) * 100) 
              : 0;
            const pillarData = pillars[pillar];

            return (
              <div key={pillar} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${PILLAR_COLORS[pillar]} text-white`}>
                      {PILLAR_ICONS[pillar] || <Users className="h-4 w-4" />}
                    </div>
                    <span className="font-medium text-gray-800">{pillar}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-800">
                      {reach.toLocaleString()}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({percentage}%)
                    </span>
                  </div>
                </div>
                <Progress
                  value={percentage}
                  className="h-2"
                />
                {pillarData && (
                  <div className="flex gap-4 text-xs text-gray-500 pl-8">
                    <span>{pillarData.programCount} programs</span>
                    <span>{pillarData.completionRate}% completion</span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Active Programs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-3xl font-bold text-emerald-800">
              {impact.activePrograms}
            </p>
            <p className="text-emerald-600">Active Programs</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-12 w-12 text-white/80 mx-auto mb-3" />
            <p className="text-lg font-semibold">
              Creating Opportunities
            </p>
            <p className="text-sm text-white/80 mt-1">
              Empowering youth through education, skills training, and employment pathways
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
        <p>
          Data last updated:{" "}
          {new Date(impact.lastUpdated).toLocaleDateString("en-KE", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-1">
          <a
            href="https://inukafoundation.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:underline"
          >
            Learn more about Inuka Foundation
          </a>
        </p>
      </div>
    </div>
  );
}
