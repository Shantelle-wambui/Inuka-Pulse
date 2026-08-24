"use client";

import { useEffect, useState } from "react";
import { Users, MapPin, GraduationCap, Briefcase } from "lucide-react";

/**
 * Compact Impact Widget
 * 
 * Minimal embeddable widget for sidebar or smaller placements.
 * Shows just the headline numbers without detailed breakdowns.
 */

interface ImpactSummary {
  totalReach: number;
  countiesCovered: number;
  overallCompletionRate: number;
  employmentRate: number;
  activePrograms: number;
  lastUpdated: string;
}

export default function CompactImpactWidget() {
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/public/impact-summary`);
        if (res.ok) {
          setImpact(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch impact data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [API_BASE]);

  if (loading) {
    return (
      <div className="p-4 text-center text-emerald-600 animate-pulse">
        Loading...
      </div>
    );
  }

  if (!impact) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Unable to load data
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-lg">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-emerald-800">Our Impact</h2>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 shadow-sm border border-emerald-100 text-center">
          <Users className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-emerald-800">
            {impact.totalReach.toLocaleString()}
          </p>
          <p className="text-xs text-emerald-600">Lives Impacted</p>
        </div>

        <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-100 text-center">
          <MapPin className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-blue-800">
            {impact.countiesCovered}
          </p>
          <p className="text-xs text-blue-600">Counties</p>
        </div>

        <div className="bg-white rounded-lg p-3 shadow-sm border border-amber-100 text-center">
          <GraduationCap className="h-5 w-5 text-amber-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-amber-800">
            {impact.overallCompletionRate}%
          </p>
          <p className="text-xs text-amber-600">Completion</p>
        </div>

        <div className="bg-white rounded-lg p-3 shadow-sm border border-purple-100 text-center">
          <Briefcase className="h-5 w-5 text-purple-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-purple-800">
            {impact.employmentRate}%
          </p>
          <p className="text-xs text-purple-600">Employment</p>
        </div>
      </div>

      {/* Footer Link */}
      <div className="text-center mt-4">
        <a
          href="https://inukafoundation.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-600 hover:underline"
        >
          Inuka Foundation →
        </a>
      </div>
    </div>
  );
}
