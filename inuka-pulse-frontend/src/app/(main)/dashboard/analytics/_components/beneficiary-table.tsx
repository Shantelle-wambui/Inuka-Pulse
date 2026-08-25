"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Filter, ChevronLeft, ChevronRight,
  ArrowUpDown, ChevronRight as DetailArrow,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RiskBandBadge } from "@/components/risk-band-badge";
import { BAND_DOT_CLASSES, PREDICTION_BANDS } from "@/components/risk-distribution-chart";
import {
  fetchBeneficiaryList,
  type BeneficiaryPrediction,
  type PagedBeneficiaries,
} from "@/lib/inuka-pulse/api";

interface BeneficiaryTableProps {
  initialData: PagedBeneficiaries;
  counties: string[];
  pillars: string[];
}

export function BeneficiaryTable({ initialData, counties, pillars }: BeneficiaryTableProps) {
  const router  = useRouter();
  const [data, setData]         = useState<PagedBeneficiaries>(initialData);
  const [search, setSearch]     = useState("");
  const [band, setBand]         = useState("all");
  const [county, setCounty]     = useState("all");
  const [pillar, setPillar]     = useState("all");
  const [page, setPage]         = useState(0);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async (
    newPage: number,
    newBand = band,
    newCounty = county,
    newPillar = pillar,
  ) => {
    setLoading(true);
    try {
      const result = await fetchBeneficiaryList({
        band:   newBand   !== "all" ? newBand   : undefined,
        county: newCounty !== "all" ? newCounty : undefined,
        pillar: newPillar !== "all" ? newPillar : undefined,
        page:   newPage,
        size:   50,
      });
      setData(result);
      setPage(newPage);
    } catch (e) {
      console.error("Failed to load beneficiaries", e);
    } finally {
      setLoading(false);
    }
  }, [band, county, pillar]);

  const handleFilter = (key: "band" | "county" | "pillar", value: string) => {
    const newBand   = key === "band"   ? value : band;
    const newCounty = key === "county" ? value : county;
    const newPillar = key === "pillar" ? value : pillar;
    if (key === "band")   setBand(value);
    if (key === "county") setCounty(value);
    if (key === "pillar") setPillar(value);
    load(0, newBand, newCounty, newPillar);
  };

  // Client-side search (filters the current page)
  const visible = search
    ? data.content.filter(b =>
        b.beneficiaryId.toLowerCase().includes(search.toLowerCase()) ||
        (b.county ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (b.cohortId ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : data.content;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">All Beneficiaries</CardTitle>
            <Badge variant="outline" className="text-xs tabular-nums">
              {data.totalElements.toLocaleString()} total
            </Badge>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ID, county…"
                className="pl-8 h-8 text-sm w-44"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={band} onValueChange={v => handleFilter("band", v)}>
              <SelectTrigger className="h-8 text-sm w-32">
                <Filter className="size-3.5 mr-1" />
                <SelectValue placeholder="Band" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All bands</SelectItem>
                {/* Render in descending risk order */}
                {[...PREDICTION_BANDS].reverse().map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={county} onValueChange={v => handleFilter("county", v)}>
              <SelectTrigger className="h-8 text-sm w-32">
                <SelectValue placeholder="County" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All counties</SelectItem>
                {counties.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={pillar} onValueChange={v => handleFilter("pillar", v)}>
              <SelectTrigger className="h-8 text-sm w-32">
                <SelectValue placeholder="Pillar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pillars</SelectItem>
                {pillars.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
          <div className="col-span-3 flex items-center gap-1"><ArrowUpDown className="size-3" /> Beneficiary ID</div>
          <div className="col-span-2">Risk Band</div>
          <div className="col-span-2 tabular-nums">Dropout Risk</div>
          <div className="col-span-2">County</div>
          <div className="col-span-2">Pillar</div>
          <div className="col-span-1" />
        </div>

        {/* Rows */}
        <div className={`divide-y divide-border ${loading ? "opacity-50" : ""} transition-opacity`}>
          {visible.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              No beneficiaries match your filters.
            </div>
          ) : (
            visible.map((b: BeneficiaryPrediction) => (
              <button
                key={b.beneficiaryId}
                onClick={() => router.push(`/dashboard/case-manager/beneficiary/${encodeURIComponent(b.beneficiaryId)}`)}
                className="w-full grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left group items-center"
              >
                <div className="col-span-3 flex items-center gap-2 font-mono font-medium truncate">
                  <span className={`size-2 rounded-full shrink-0 ${BAND_DOT_CLASSES[b.predictedBand as keyof typeof BAND_DOT_CLASSES] ?? "bg-muted"}`} />
                  {b.beneficiaryId}
                </div>
                <div className="col-span-2">
                  <RiskBandBadge band={b.predictedBand} />
                </div>
                <div className="col-span-2 tabular-nums font-medium">{b.dropoutProbPct}</div>
                <div className="col-span-2 text-muted-foreground truncate">{b.county ?? "—"}</div>
                <div className="col-span-2 text-muted-foreground truncate">{b.pillar ?? "—"}</div>
                <div className="col-span-1 flex justify-end">
                  <DetailArrow className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
            <span>
              Page {data.number + 1} of {data.totalPages} ·{" "}
              {data.totalElements.toLocaleString()} beneficiaries
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="sm"
                disabled={data.number === 0 || loading}
                onClick={() => load(page - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={data.number >= data.totalPages - 1 || loading}
                onClick={() => load(page + 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
