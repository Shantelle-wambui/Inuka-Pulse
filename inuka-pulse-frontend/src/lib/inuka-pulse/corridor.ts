/**
 * Typed fetch wrappers for the corridor heatmap / cohort map page.
 *
 * Rewired to use the working /api/sites/risk-summary endpoint and transform
 * the SiteRiskSummary[] response into the HeatPoint[] and CorridorAsset[]
 * shapes that the existing CorridorSites component expects.
 *
 * Mock fallback strategy (hackathon demo safety):
 *   - If the backend returns an empty array, fall back to mockSites so the
 *     cohort map always renders meaningful data during the demo.
 */

import { getAuthToken } from "@/server/server-actions";
import type { SiteRiskSummary } from "./types";
import { mockSites } from "@/app/(main)/dashboard/inuka/_components/inuka-data";

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error(
      "NEXT_PUBLIC_INUKA_API_URL is not set. " +
        "Add it to .env.local, e.g. NEXT_PUBLIC_INUKA_API_URL=http://localhost:8080",
    );
  }
  return API_BASE;
}

const TIMEOUT_MS = 10_000;

/**
 * Returns an AbortSignal that fires after TIMEOUT_MS.
 *
 * AbortSignal.timeout() is avoided here because it throws a DOMException
 * (TimeoutError) whose .message property is a read-only getter. Turbopack's
 * error boundary tries to write to .message and crashes with:
 *   "TypeError: Cannot set property message of which has only a getter"
 *
 * Using AbortController + setTimeout throws a plain Error instead, which
 * the error boundary handles cleanly.
 */
function makeTimeoutSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(
    () => controller.abort(new Error(`Request timed out after ${TIMEOUT_MS}ms`)),
    TIMEOUT_MS,
  );
  return controller.signal;
}

async function authedOpts(): Promise<RequestInit> {
  const token = await getAuthToken();
  return {
    cache: "no-store",
    signal: makeTimeoutSignal(),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.message ?? body.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeatPoint {
  assetId: string;
  lat: number;
  lon: number;
  weight: number;
  band: "low" | "medium" | "high" | "critical";
}

export interface CorridorAsset {
  assetId: string;
  assetType: string;
  nearestSiteCode: string | null;
  segment: string;
  chainageKmApprox: number;
  latitude: number;
  longitude: number;
  floodLandslideRiskZone: string;
  sensorSuite: string;
}

// ─── Transformation helpers ───────────────────────────────────────────────────

function toHeatPoint(site: SiteRiskSummary): HeatPoint {
  return {
    assetId: site.siteId,
    lat: site.latitude,
    lon: site.longitude,
    weight: site.riskScore / 100,
    band: site.severityBand.toLowerCase() as HeatPoint["band"],
  };
}

function toCorridorAsset(site: SiteRiskSummary): CorridorAsset {
  let floodZone: string;
  if (site.daysSinceLastAudit >= 21) {
    floodZone = "high_flood";
  } else if (site.daysSinceLastAudit >= 8) {
    floodZone = "moderate_flood";
  } else {
    floodZone = "low";
  }

  return {
    assetId: site.siteId,
    assetType: "cohort",
    nearestSiteCode: site.siteId,
    segment: site.siteName,
    chainageKmApprox: site.incidentCount,
    latitude: site.latitude,
    longitude: site.longitude,
    floodLandslideRiskZone: floodZone,
    sensorSuite: "",
  };
}

// ─── Data fetching (shared) ───────────────────────────────────────────────────

async function fetchSiteRiskData(): Promise<SiteRiskSummary[]> {
  const res = await fetch(
    `${requireApiBase()}/api/sites/risk-summary`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: SiteRiskSummary[] = await res.json();
  // If backend has no Inuka cohorts seeded yet, fall back to mock data
  if (data.length === 0) return mockSites;
  return data;
}

// ─── Fetch wrappers (same exports as before) ─────────────────────────────────

/** Fetches risk heatmap data from /api/sites/risk-summary, mapped to HeatPoint[] */
export async function fetchRiskHeatmap(): Promise<HeatPoint[]> {
  const sites = await fetchSiteRiskData();
  return sites.map(toHeatPoint);
}

/** Fetches corridor asset data from /api/sites/risk-summary, mapped to CorridorAsset[] */
export async function fetchCorridorAssets(): Promise<CorridorAsset[]> {
  const sites = await fetchSiteRiskData();
  return sites.map(toCorridorAsset);
}
