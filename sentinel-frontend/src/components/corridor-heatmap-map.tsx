"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";

import type { CorridorAsset, HeatPoint } from "@/lib/sentinel/corridor";

// ── Constants ─────────────────────────────────────────────────────────────────

const BAND_COLOR: Record<HeatPoint["band"], string> = {
  low:      "#22c55e",
  medium:   "#eab308",
  high:     "#f97316",
  critical: "#ef4444",
};

const BAND_RADIUS: Record<HeatPoint["band"], number> = {
  low:      7,
  medium:   9,
  high:     11,
  critical: 14,
};

const HEAT_GRADIENT = {
  0.0:  "#22c55e",
  0.30: "#22c55e",
  0.55: "#eab308",
  0.75: "#f97316",
  1.0:  "#ef4444",
};

// ── Tile layer definitions ─────────────────────────────────────────────────────
type TileTheme = "light" | "terrain";

const TILE_LAYERS: Record<TileTheme, { url: string; attribution: string; name: string }> = {
  light: {
    name: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, © <a href='https://carto.com/'>CARTO</a>",
  },
  terrain: {
    name: "Terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles © <a href='https://www.esri.com/'>Esri</a> &mdash; Esri, USGS, NOAA",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseWeights(points: HeatPoint[]): [number, number, number][] {
  if (points.length === 0) return [];
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min;
  return points.map((p) => {
    const normalised = range === 0 ? 0.5 : 0.05 + ((p.weight - min) / range) * 0.95;
    return [p.lat, p.lon, normalised];
  });
}

/**
 * Derive a human-readable pillar name from the assetId or segment field.
 * assetId format from generate_inuka_data.py: "cohort-sc-001", "cohort-pl-002", etc.
 */
function pillarFromId(assetId: string): string {
  const code = assetId.split("-")[1]?.toLowerCase();
  const pillars: Record<string, string> = {
    sc: "Scholarship",
    pl: "Plus",
    vn: "Vocational",
    tc: "Tech",
  };
  return pillars[code ?? ""] ?? "Programme";
}

/** Build the Leaflet popup HTML for a cohort marker */
function buildPopupHtml(p: HeatPoint, meta?: CorridorAsset): string {
  const score = (p.weight * 100).toFixed(0);
  const bandLabel = p.band.charAt(0).toUpperCase() + p.band.slice(1);
  const bandColor = BAND_COLOR[p.band];

  // Use meta.segment as county name, meta.nearestSiteCode as cohort ID
  const county   = meta?.segment  ?? "—";
  const cohortId = meta?.nearestSiteCode ?? p.assetId;
  const pillar   = pillarFromId(p.assetId);

  // meta.chainageKmApprox repurposed → at-risk beneficiary count (from generate_inuka_data.py)
  const atRisk = meta && meta.chainageKmApprox > 0 ? `${Math.round(meta.chainageKmApprox)} beneficiaries at risk` : null;

  // meta.floodLandslideRiskZone repurposed → days since last field visit
  const visitDays = meta?.floodLandslideRiskZone
    ? ({ high_flood: "21+ days", moderate_flood: "8–20 days", low: "Within 7 days" }[meta.floodLandslideRiskZone] ?? "—")
    : null;

  const siteLink = cohortId
    ? `<a href="/dashboard/sentinel/sites/${cohortId.toLowerCase()}" style="color:#3b82f6;text-decoration:underline;font-size:11px">View cohort detail →</a>`
    : "";

  return `
    <div style="font-family:system-ui,sans-serif;min-width:200px;font-size:12px;line-height:1.5">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-weight:700;font-size:13px">${county}</span>
        <span style="background:${bandColor}22;color:${bandColor};border:1px solid ${bandColor}55;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">${bandLabel}</span>
      </div>
      <div style="display:grid;gap:3px">
        <div><span style="color:#9ca3af">Pillar:</span> <strong>${pillar}</strong></div>
        <div><span style="color:#9ca3af">Vulnerability score:</span> <strong style="color:${bandColor}">${score}/100</strong></div>
        ${atRisk ? `<div><span style="color:#9ca3af">At risk:</span> ${atRisk}</div>` : ""}
        ${visitDays ? `<div><span style="color:#9ca3af">Last field visit:</span> ${visitDays}</div>` : ""}
        <div style="font-size:10px;color:#9ca3af">Cohort ID: ${cohortId}</div>
        ${siteLink ? `<div style="margin-top:4px">${siteLink}</div>` : ""}
      </div>
    </div>
  `.trim();
}

interface Removable {
  remove: () => void;
  // biome-ignore lint/suspicious/noExplicitAny: leaflet.heat returns a dynamic layer
  addTo: (map: any) => this;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CorridorHeatmapMapProps {
  points: HeatPoint[];
  assets: CorridorAsset[];
  selectedAssetId: string | null;
  onSelect: (assetId: string | null) => void;
}

export function CorridorHeatmapMap({ points, assets, selectedAssetId, onSelect }: CorridorHeatmapMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef    = useRef<import("leaflet").TileLayer | null>(null);
  const onSelectRef     = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const [mapReady, setMapReady]     = useState(false);
  const [theme, setTheme]           = useState<TileTheme>("light");

  // Build assetId → CorridorAsset lookup once
  const assetMap = new Map(assets.map((a) => [a.assetId, a]));

  // ── Initialise map once — centred on Kenya ──────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      // Fix broken default icon paths under webpack/Next.js
      type IconDefaultExt = typeof L.Icon.Default & { prototype: { _getIconUrl?: unknown } };
      const IconDefault = L.Icon.Default as IconDefaultExt;
      delete IconDefault.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Kenya centre-point, zoom 6 to show all counties
      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([-0.5, 37.5], 6);

      const tl = L.tileLayer(TILE_LAYERS.light.url, {
        attribution: TILE_LAYERS.light.attribution,
        maxZoom: 18,
      }).addTo(map);
      tileLayerRef.current = tl;

      map.on("click", () => { onSelectRef.current(null); });

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ── Swap tile layer when theme changes ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then((L) => {
      if (!mapRef.current) return;
      tileLayerRef.current?.remove();
      const cfg = TILE_LAYERS[theme];
      tileLayerRef.current = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: 18,
      }).addTo(mapRef.current);
    });
  }, [mapReady, theme]);

  // ── Render heat layer and cohort markers ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || points.length === 0) return;

    const map = mapRef.current;
    const layersToClean: Removable[] = [];
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled) return;

      // ── 1. Heat layer ─────────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).L = L;
      await import("leaflet.heat");
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heatFn = (window as any).L?.heatLayer;
      if (typeof heatFn === "function") {
        const heatLayer = heatFn(normaliseWeights(points), {
          radius:   28,
          blur:     20,
          maxZoom:  14,
          gradient: HEAT_GRADIENT,
        }) as Removable;
        heatLayer.addTo(map);
        layersToClean.push(heatLayer);
      }

      // ── 2. Cohort circle markers with popups ──────────────────────────
      for (const p of points) {
        if (cancelled) break;
        const meta = assetMap.get(p.assetId);

        const marker = L.circleMarker([p.lat, p.lon] as [number, number], {
          radius:      BAND_RADIUS[p.band],
          color:       "#fff",
          fillColor:   BAND_COLOR[p.band],
          fillOpacity: 0.9,
          weight:      2,
          interactive: true,
        })
          .bindPopup(buildPopupHtml(p, meta), {
            maxWidth:  260,
            className: "sentinel-popup",
          })
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectRef.current(p.assetId);
          })
          .addTo(map);

        layersToClean.push(marker);
      }
    })();

    return () => {
      cancelled = true;
      layersToClean.forEach((l) => l.remove());
    };
  }, [mapReady, points, assetMap]);

  // ── Pan/zoom to selected cohort ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedAssetId) return;
    const selected = points.find((p) => p.assetId === selectedAssetId);
    if (!selected) return;
    mapRef.current.flyTo([selected.lat, selected.lon], 10, { duration: 0.8 });
  }, [mapReady, selectedAssetId, points]);

  return (
    <div className="relative h-full w-full">
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="h-full w-full rounded-lg"
        aria-label="Inuka beneficiary cohort risk map — Kenya"
        role="img"
      />

      {/* Tile theme toggle — top-right */}
      <div className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-md border bg-background shadow-sm">
        {(["light", "terrain"] as TileTheme[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              theme === t
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {TILE_LAYERS[t].name}
          </button>
        ))}
      </div>

      {/* Dropout risk legend — bottom-left */}
      <div className="absolute bottom-8 left-3 z-[1000] rounded-md border bg-background/90 px-3 py-2 shadow-sm backdrop-blur-sm">
        <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Dropout risk</p>
        <div className="flex flex-col gap-1 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-full bg-red-500 border-2 border-white shadow" />
            <span>Critical — intervene now</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-full bg-orange-500 border-2 border-white shadow" />
            <span>High — escalation flagged</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-full bg-yellow-500 border-2 border-white shadow" />
            <span>Medium — monitor closely</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-full bg-green-500 border-2 border-white shadow" />
            <span>Low — on track</span>
          </div>
        </div>
      </div>
    </div>
  );
}
