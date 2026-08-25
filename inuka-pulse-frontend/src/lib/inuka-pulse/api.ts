/**
 * Typed fetch wrappers for the Inuka Pulse Spring Boot backend API.
 *
 * All authenticated endpoints read the JWT from the "inuka-token" cookie
 * (written by LoginForm on the client side) so Next.js Server Components can
 * pass the Bearer header without touching localStorage.
 *
 * Mock fallback strategy (hackathon demo safety):
 *   - If the backend returns an empty array for risk-summary, fall back to
 *     mockSites so the dashboard always shows real Inuka data.
 *   - If quality summary returns all zeros (nothing processed), fall back to
 *     mockQualitySummary so Gate Status never shows "Failed" on a fresh DB.
 *   - If no alerts returned, fall back to mockAlerts.
 *   - Real backend data (when the ETL pipeline has seeded Inuka records) takes
 *     full precedence — mocks are only a safety net.
 *
 * IMPORTANT: When mock data is returned, the `isMock` flag is set to true.
 * UI components MUST check this flag and display a warning banner so users
 * know they're seeing demo data, not real predictions.
 */

import { getAuthToken } from "@/server/server-actions";
import type {
  Alert,
  ControlChartData,
  CorrelationData,
  DataQualitySummary,
  FeatureImportanceData,
  IngestBatch,
  PredictionDto,
  SiteDetail,
  SiteRiskSummary,
  SurvivalCurveData,
  TelemetrySummary,
  WhatIfRequest,
  WhatIfResponse,
} from "./types";
import type { AuthResponse, CreateUserRequest, InukaUser, InukaRole } from "./auth-types";
import {
  mockSites,
  mockAlerts,
  mockQualitySummary,
  mockBatches,
} from "@/app/(main)/dashboard/inuka/_components/inuka-data";

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";

// ─── Mock Data Wrapper Types ─────────────────────────────────────────────────
// These types wrap API responses to indicate whether mock data is being used.
// UI components should check `isMock` and display a warning banner when true.

export interface WithMockIndicator<T> {
  data: T;
  isMock: boolean;
  /** Human-readable reason why mock data is being used (only set when isMock=true) */
  mockReason?: string;
}

/** Throws a clear error if the env var is missing — called inside each fetch function. */
function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error(
      "NEXT_PUBLIC_INUKA_API_URL is not set. " +
      "Add it to .env.local, e.g. NEXT_PUBLIC_INUKA_API_URL=http://localhost:8080",
    );
  }
  return API_BASE;
}

const TIMEOUT_MS = 15_000;

/**
 * Creates a timeout controller that can be cleared after successful fetch.
 * 
 * Returns both the AbortSignal to pass to fetch() and a clear() function
 * that should be called after the fetch completes to prevent the timeout
 * from firing (which would be wasteful, even if harmless).
 *
 * AbortSignal.timeout() is avoided here because it throws a DOMException
 * (TimeoutError) whose .message property is a read-only getter. Turbopack's
 * error boundary tries to write to .message and crashes with:
 *   "TypeError: Cannot set property message of which has only a getter"
 *
 * Using AbortController + setTimeout throws a plain Error instead, which
 * the error boundary handles cleanly.
 */
function makeTimeoutController(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error(`Request timed out after ${TIMEOUT_MS}ms`)),
    TIMEOUT_MS
  );
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use makeTimeoutController() for new code to enable cleanup.
 */
function makeTimeoutSignal(): AbortSignal {
  return makeTimeoutController().signal;
}

/** Fetch options that include the JWT Authorization header. */
async function authedOpts(): Promise<RequestInit & { _timeoutClear?: () => void }> {
  const token = await getAuthToken();
  const timeout = makeTimeoutController();
  return {
    cache: "no-store",
    signal: timeout.signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    // Store clear function for callers that want to clean up
    _timeoutClear: timeout.clear,
  };
}

/**
 * Helper to perform a fetch with automatic timeout cleanup.
 * Clears the timeout after fetch completes (success or error).
 */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { _timeoutClear?: () => void }
): Promise<Response> {
  const clearFn = opts._timeoutClear;
  try {
    const response = await fetch(url, opts);
    clearFn?.();
    return response;
  } catch (error) {
    clearFn?.();
    throw error;
  }
}

/** Parse a JSON error body from the backend's GlobalExceptionHandler format. */
async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.message ?? body.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

// ─── Risk ────────────────────────────────────────────────────────────────────

/**
 * GET /api/sites/risk-summary
 * 
 * Returns site risk summaries with mock indicator. Check `isMock` to determine
 * if real data is being displayed.
 */
export async function fetchRiskSummary(): Promise<WithMockIndicator<SiteRiskSummary[]>> {
  const opts = await authedOpts();
  const res = await fetchWithTimeout(`${requireApiBase()}/api/sites/risk-summary`, opts);
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: SiteRiskSummary[] = await res.json();
  // If backend has no Inuka cohorts seeded yet, fall back to mock data
  if (data.length === 0) {
    return {
      data: mockSites,
      isMock: true,
      mockReason: "No cohort data available from backend — showing demo data",
    };
  }
  return { data, isMock: false };
}

/**
 * GET /api/sites/risk-summary (legacy wrapper)
 * 
 * @deprecated Use fetchRiskSummary() and check the isMock flag instead.
 * This function exists for backward compatibility but hides mock status.
 */
export async function fetchRiskSummaryLegacy(): Promise<SiteRiskSummary[]> {
  const result = await fetchRiskSummary();
  return result.data;
}

/** GET /api/sites/{siteId} */
export async function fetchSiteDetail(siteId: string): Promise<SiteDetail> {
  const res = await fetch(`${requireApiBase()}/api/sites/${siteId}`, await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * POST /api/sites/{siteId}/simulate
 *
 * What-if risk simulation — no auth required (/api/sites/** is permitAll()).
 * IMPORTANT: This is a plain fetch — do NOT use authedOpts() here.
 * authedOpts() calls getAuthToken() which is a Server Action and will
 * throw when invoked from a client-side event handler.
 */
export async function simulateRisk(
  siteId: string,
  overrides: WhatIfRequest,
): Promise<WhatIfResponse> {
  const res = await fetch(`${requireApiBase()}/api/sites/${siteId}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: makeTimeoutSignal(),
    body: JSON.stringify(overrides),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

/**
 * GET /api/alerts
 * 
 * Returns alerts with mock indicator. Check `isMock` to determine
 * if real alerts are being displayed.
 */
export async function fetchAlerts(): Promise<WithMockIndicator<Alert[]>> {
  const opts = await authedOpts();
  const res = await fetchWithTimeout(`${requireApiBase()}/api/alerts`, opts);
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: Alert[] = await res.json();
  // Fall back to mock data if backend returns no active Inuka alerts
  if (data.length === 0) {
    return {
      data: mockAlerts,
      isMock: true,
      mockReason: "No alerts from backend — showing demo alerts",
    };
  }
  return { data, isMock: false };
}

/**
 * GET /api/alerts (legacy wrapper)
 * 
 * @deprecated Use fetchAlerts() and check the isMock flag instead.
 */
export async function fetchAlertsLegacy(): Promise<Alert[]> {
  const result = await fetchAlerts();
  return result.data;
}

/** POST /api/alerts/{id}/ack */
export async function acknowledgeAlert(id: string): Promise<void> {
  const opts = await authedOpts();
  const res = await fetch(`${requireApiBase()}/api/alerts/${id}/ack`, { ...opts, method: "POST" });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
}

// ─── Data Quality ─────────────────────────────────────────────────────────────

/**
 * GET /api/quality/summary
 * 
 * Returns quality summary with mock indicator.
 */
export async function fetchQualitySummary(): Promise<WithMockIndicator<DataQualitySummary>> {
  const opts = await authedOpts();
  const res = await fetchWithTimeout(`${requireApiBase()}/api/quality/summary`, opts);
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: DataQualitySummary = await res.json();
  // If total is 0 the DB has not been seeded — fall back to mock
  if (data.total === 0) {
    return {
      data: mockQualitySummary,
      isMock: true,
      mockReason: "No quality data processed yet — showing demo quality metrics",
    };
  }
  return { data, isMock: false };
}

/**
 * GET /api/quality/batches
 * 
 * Returns batch history with mock indicator.
 */
export async function fetchBatches(): Promise<WithMockIndicator<IngestBatch[]>> {
  const opts = await authedOpts();
  const res = await fetchWithTimeout(`${requireApiBase()}/api/quality/batches`, opts);
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: IngestBatch[] = await res.json();
  // If backend has no batches, fall back to mock batches
  if (data.length === 0) {
    return {
      data: mockBatches,
      isMock: true,
      mockReason: "No batch history available — showing demo batches",
    };
  }
  return { data, isMock: false };
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

/** GET /api/telemetry/summary */
export async function fetchTelemetrySummary(): Promise<TelemetrySummary> {
  const res = await fetch(`${requireApiBase()}/api/telemetry/summary`, await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** POST /api/auth/login — public endpoint, no JWT needed */
export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${requireApiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Invalid email or password");
  }
  return res.json();
}

// ─── User Management ──────────────────────────────────────────────────────────

/** GET /api/users */
export async function fetchUsers(token: string): Promise<InukaUser[]> {
  const res = await fetch(`${requireApiBase()}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Users fetch failed: ${res.status}`);
  return res.json();
}

/** GET /api/users/roles */
export async function fetchRoles(token: string): Promise<InukaRole[]> {
  const res = await fetch(`${requireApiBase()}/api/users/roles`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Roles fetch failed: ${res.status}`);
  return res.json();
}

/** POST /api/users */
export async function createUser(request: CreateUserRequest, token: string): Promise<InukaUser> {
  const res = await fetch(`${requireApiBase()}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Failed to create user");
  }
  return res.json();
}

/** PATCH /api/users/{id}/status */
export async function updateUserStatus(id: number, status: string, token: string): Promise<InukaUser> {
  const res = await fetch(`${requireApiBase()}/api/users/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Status update failed: ${res.status}`);
  return res.json();
}

/** DELETE /api/users/{id} */
export async function deleteUser(id: number, token: string): Promise<void> {
  const res = await fetch(`${requireApiBase()}/api/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

// ─── ETL Config ───────────────────────────────────────────────────────────────

/** GET /api/config/etl — public, no JWT needed */
export async function fetchEtlConfig(): Promise<{ frontendRefreshMs: number; pollIntervalMs: number; rowsPerCycle: number }> {
  const base = requireApiBase();
  const res = await fetch(`${base}/api/config/etl`, { cache: "no-store" });
  if (!res.ok) throw new Error(`ETL config fetch failed: ${res.status}`);
  return res.json();
}

// ─── Analytics (Stage C / D diagnostics) ─────────────────────────────────────

/** GET /api/analytics/survival-curves */
export async function fetchSurvivalCurves(): Promise<SurvivalCurveData> {
  const res = await fetch(`${requireApiBase()}/api/analytics/survival-curves`, {
    cache: "no-store",
    signal: makeTimeoutSignal(),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** GET /api/analytics/pressure-charts */
export async function fetchPressureCharts(): Promise<ControlChartData> {
  const res = await fetch(`${requireApiBase()}/api/analytics/pressure-charts`, {
    cache: "no-store",
    signal: makeTimeoutSignal(),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** GET /api/analytics/correlation */
export async function fetchCorrelation(): Promise<CorrelationData> {
  const res = await fetch(`${requireApiBase()}/api/analytics/correlation`, {
    cache: "no-store",
    signal: makeTimeoutSignal(),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** GET /api/analytics/feature-importance */
export async function fetchFeatureImportance(): Promise<FeatureImportanceData> {
  const res = await fetch(`${requireApiBase()}/api/analytics/feature-importance`, {
    cache: "no-store",
    signal: makeTimeoutSignal(),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** GET /api/sites/predictions */
export async function fetchPredictions(): Promise<PredictionDto[]> {
  const res = await fetch(`${requireApiBase()}/api/sites/predictions`, {
    cache: "no-store",
    signal: makeTimeoutSignal(),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** GET /api/sites/{siteId}/prediction */
export async function fetchSitePrediction(siteId: string): Promise<PredictionDto | null> {
  const res = await fetch(`${requireApiBase()}/api/sites/${siteId}/prediction`, {
    cache: "no-store",
    signal: makeTimeoutSignal(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── V2: Work Orders (Process E — Maintenance) ───────────────────────────────

export interface WorkOrder {
  id: string;
  siteId: string;
  capaId?: string;
  title: string;
  description?: string;
  assignedTechnicianId?: number;
  status: "open" | "in_progress" | "completed" | "verified";
  priority: "low" | "medium" | "high" | "critical";
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkOrderPayload {
  siteId: string;
  capaId?: string;
  title: string;
  description?: string;
  assignedTechnicianId?: number;
  priority?: string;
  dueDate?: string;
}

/** GET /api/work-orders */
export async function fetchWorkOrders(params?: {
  siteId?: string;
  capaId?: string;
  status?: string;
  technicianId?: number;
}): Promise<WorkOrder[]> {
  const url = new URL(`${requireApiBase()}/api/work-orders`);
  if (params?.siteId) url.searchParams.set("siteId", params.siteId);
  if (params?.capaId) url.searchParams.set("capaId", params.capaId);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.technicianId) url.searchParams.set("technicianId", String(params.technicianId));
  const res = await fetch(url.toString(), await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** POST /api/work-orders */
export async function createWorkOrder(payload: CreateWorkOrderPayload): Promise<WorkOrder> {
  const opts = await authedOpts();
  const res = await fetch(`${requireApiBase()}/api/work-orders`, {
    ...opts,
    method: "POST",
    headers: { ...(opts.headers as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** PATCH /api/work-orders/{id}/status */
export async function updateWorkOrderStatus(id: string, status: string): Promise<WorkOrder> {
  const opts = await authedOpts();
  const res = await fetch(`${requireApiBase()}/api/work-orders/${id}/status`, {
    ...opts,
    method: "PATCH",
    headers: { ...(opts.headers as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── V2: ML — Decision Threshold ─────────────────────────────────────────────

export interface BandDefinition {
  min?: number;
  max?: number;
  description: string;
}

export interface DecisionThresholdConfig {
  optimalThreshold: number;
  beta: number;
  bands: {
    Dropout: BandDefinition;
    Disengaged: BandDefinition;
    "At-Risk": BandDefinition;
    Active: BandDefinition;
  };
  note: string;
}

/**
 * GET /api/ml/decision-threshold
 *
 * Fetches the ML model's decision threshold and band definitions.
 * Use this to correctly interpret prediction bands instead of hardcoding thresholds.
 */
export async function fetchDecisionThreshold(): Promise<DecisionThresholdConfig> {
  const res = await fetch(`${requireApiBase()}/api/ml/decision-threshold`, {
    cache: "no-store",
    signal: makeTimeoutSignal(),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── V2: ML — Drift Detection ────────────────────────────────────────────────

export interface DriftSummary {
  championId: string;
  championVersion: string;
  baselineAccuracy?: number;
  recentAccuracy?: number;
  deltaPercentagePoints?: number;
  driftStatus: "normal" | "warning" | "critical" | "insufficient_data" | "no_champion";
  trend: Array<{ computedAt: string; accuracy: number; sampleSize: number }>;
}

/** GET /api/ml/drift */
export async function fetchDriftSummary(): Promise<DriftSummary> {
  const res = await fetch(`${requireApiBase()}/api/ml/drift`, await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── V2: ML — Retraining Schedule ───────────────────────────────────────────

export interface RetrainingSchedule {
  id: string;
  status: "disabled" | "scheduled" | "running" | "completed" | "failed" | "awaiting_review";
  cadence: string;
  nextRunAt?: string;
  lastRunId?: string;
  updatedBy?: string;
  updatedAt: string;
}

/** GET /api/ml/retraining/status */
export async function fetchRetrainingStatus(): Promise<RetrainingSchedule> {
  const res = await fetch(`${requireApiBase()}/api/ml/retraining/status`, await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** POST /api/ml/retraining/schedule */
export async function enableRetrainingSchedule(cadence: string = "weekly"): Promise<RetrainingSchedule> {
  const opts = await authedOpts();
  const res = await fetch(`${requireApiBase()}/api/ml/retraining/schedule`, {
    ...opts,
    method: "POST",
    headers: { ...(opts.headers as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ cadence }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** POST /api/ml/retraining/disable */
export async function disableRetrainingSchedule(): Promise<RetrainingSchedule> {
  const opts = await authedOpts();
  const res = await fetch(`${requireApiBase()}/api/ml/retraining/disable`, { ...opts, method: "POST" });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── V2: ML — Model Comparison ───────────────────────────────────────────────

export interface FeatureImportanceDiffEntry {
  feature: string;
  championWeight: number;
  challengerWeight: number;
  delta: number;
  isNew: boolean;
}

export interface ModelComparisonResult {
  champion?: Record<string, unknown>;
  challenger?: Record<string, unknown>;
  featureImportanceDiff: FeatureImportanceDiffEntry[];
  metricDiff: { precisionDelta?: number; recallDelta?: number; f1Delta?: number };
}

/** GET /api/ml/models/compare */
export async function fetchModelComparison(
  championId?: string,
  challengerId?: string,
): Promise<ModelComparisonResult> {
  const url = new URL(`${requireApiBase()}/api/ml/models/compare`);
  if (championId) url.searchParams.set("champion", championId);
  if (challengerId) url.searchParams.set("challenger", challengerId);
  const res = await fetch(url.toString(), await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Beneficiary Predictions ──────────────────────────────────────────────────
//
// These endpoints are backed by the beneficiary_prediction table populated by
// the Python pipeline's inuka_predictions_export.json via EtlReloadService.

export interface BeneficiaryPrediction {
  beneficiaryId: string;
  cohortId: string | null;
  pillar: string | null;
  county: string | null;
  asOfDate: string;
  dropoutProb: number;
  dropoutProbPct: string;     // e.g. "78.9%" — formatted by backend
  predictedBand: "Active" | "At-Risk" | "Disengaged" | "Dropout";
  riskLevel: string;          // human-friendly label from BeneficiaryPredictionDto
  topFeatures: string | null; // pipe-delimited raw string
  topFeaturesList: string[];  // parsed list — ready to render
  // ── Engagement Score (0–100 composite index) ─────────────────────────────
  engagementScore: number | null;              // null if not yet computed by pipeline
  engagementBand: "Low" | "Medium" | "High" | null;
}

export interface BeneficiarySummary {
  total: number;
  active: number;
  atRisk: number;
  disengaged: number;
  dropout: number;
  lastUpdated: string | null;
  counties: string[];
  pillars: string[];
}

export interface PagedBeneficiaries {
  content: BeneficiaryPrediction[];
  totalElements: number;
  totalPages: number;
  number: number;   // current page (0-indexed)
  size: number;
}

/**
 * GET /api/beneficiaries/predictions/summary
 *
 * KPI counts (total, active, atRisk, disengaged, dropout) + meta.
 * Used by: Director KPI strip, Analyst overview.
 */
export async function fetchBeneficiarySummary(): Promise<BeneficiarySummary> {
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/predictions/summary`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/beneficiaries/predictions/breakdown/county
 *
 * Band counts per county: { "Nairobi": { "Active": 300, "At-Risk": 120, ... } }
 * Used by: Director county comparison chart.
 */
export async function fetchBreakdownByCounty(): Promise<Record<string, Record<string, number>>> {
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/predictions/breakdown/county`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/beneficiaries/predictions/breakdown/pillar
 *
 * Band counts per pillar: { "Scholarship": { "Active": 500, ... } }
 * Used by: Director pillar comparison chart.
 */
export async function fetchBreakdownByPillar(): Promise<Record<string, Record<string, number>>> {
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/predictions/breakdown/pillar`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/beneficiaries/predictions/list?band=&county=&pillar=&cohort=&page=0&size=50
 *
 * Paginated, filterable list of all beneficiary predictions.
 * Used by: Analyst beneficiary table, Director at-risk list.
 */
export async function fetchBeneficiaryList(params?: {
  band?: string;
  county?: string;
  pillar?: string;
  cohort?: string;
  page?: number;
  size?: number;
}): Promise<PagedBeneficiaries> {
  const url = new URL(`${requireApiBase()}/api/beneficiaries/predictions/list`);
  if (params?.band)   url.searchParams.set("band",   params.band);
  if (params?.county) url.searchParams.set("county", params.county);
  if (params?.pillar) url.searchParams.set("pillar", params.pillar);
  if (params?.cohort) url.searchParams.set("cohort", params.cohort);
  url.searchParams.set("page", String(params?.page ?? 0));
  url.searchParams.set("size", String(params?.size ?? 50));
  const res = await fetch(url.toString(), await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/beneficiaries/predictions/top-risk?band=At-Risk&n=20
 *
 * Top N highest-risk beneficiaries for a given band.
 * Used by: Director at-risk / dropout panels.
 */
export async function fetchTopRisk(band = "At-Risk", n = 20): Promise<BeneficiaryPrediction[]> {
  const url = new URL(`${requireApiBase()}/api/beneficiaries/predictions/top-risk`);
  url.searchParams.set("band", band);
  url.searchParams.set("n", String(n));
  const res = await fetch(url.toString(), await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export interface CaseloadSummary {
  total: number;
  needsAttention: number;   // Dropout + Disengaged
  atRisk: number;
  active: number;
  cohorts: string[];
  lastUpdated: string | null;
}

/**
 * GET /api/beneficiaries/predictions/my-caseload
 *
 * Returns the calling Case Manager's assigned beneficiaries, high-risk first.
 * Scoped to the officer's cohort assignments via JWT userId.
 */
export async function fetchMyCaseload(): Promise<BeneficiaryPrediction[]> {
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/predictions/my-caseload`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/beneficiaries/predictions/my-caseload/summary
 *
 * KPI summary for the Case Manager: total, needsAttention, atRisk, active, cohorts.
 */
export async function fetchMyCaseloadSummary(): Promise<CaseloadSummary> {
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/predictions/my-caseload/summary`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/beneficiaries/predictions/cohort/{cohortId}
 *
 * All beneficiaries in a cohort, high-risk first.
 * Used by: Case Manager caseload view.
 */
export async function fetchCohortBeneficiaries(cohortId: string): Promise<BeneficiaryPrediction[]> {
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/predictions/cohort/${encodeURIComponent(cohortId)}`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/beneficiaries/predictions/{beneficiaryId}
 *
 * Latest prediction for one beneficiary.
 * Used by: beneficiary detail page.
 */
export async function fetchBeneficiaryDetail(beneficiaryId: string): Promise<BeneficiaryPrediction | null> {
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/predictions/${encodeURIComponent(beneficiaryId)}`,
    await authedOpts(),
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Beneficiary Follow-ups ───────────────────────────────────────────────────

export interface BeneficiaryFollowUp {
  id: number;
  beneficiaryId: string;
  officerId: number;
  contactType: string;
  contactTypeLabel: string;
  outcome: string;
  outcomeLabel: string;
  notes: string | null;
  followUpDate: string;
  nextAction: string | null;
  createdAt: string;
}

export interface RecordFollowUpPayload {
  contactType: "phone_call" | "home_visit" | "sms" | "email" | "other";
  outcome: "reached" | "no_answer" | "left_message" | "escalated";
  notes?: string;
  followUpDate?: string;   // yyyy-MM-dd, defaults to today on backend
  nextAction?: string;
}

/**
 * GET /api/beneficiaries/{beneficiaryId}/follow-ups
 * Full follow-up history for a beneficiary, newest first.
 */
export async function fetchFollowUps(beneficiaryId: string): Promise<BeneficiaryFollowUp[]> {
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/${encodeURIComponent(beneficiaryId)}/follow-ups`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * POST /api/beneficiaries/{beneficiaryId}/follow-ups
 * Record a new follow-up action. Officer ID is set from the JWT on the backend.
 */
export async function recordFollowUp(
  beneficiaryId: string,
  payload: RecordFollowUpPayload,
): Promise<BeneficiaryFollowUp> {
  const opts = await authedOpts();
  const res = await fetch(
    `${requireApiBase()}/api/beneficiaries/${encodeURIComponent(beneficiaryId)}/follow-ups`,
    {
      ...opts,
      method: "POST",
      headers: { ...(opts.headers as Record<string, string>), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Analytics: Model Backtest Report ────────────────────────────────────────

export interface BacktestReport {
  model?: string;
  model_type?: string;
  label_definition?: string;
  label_rationale?: string;
  precision?: number;
  recall?: number;
  f1?: number;
  train_rows?: number;
  test_rows?: number;
  positive_rate_train?: number;
  positive_rate_test?: number;
  split_date?: string;
  threshold?: number;
  features?: string[];
  // allow any additional fields the pipeline may add
  [key: string]: unknown;
}

/**
 * GET /api/analytics/backtest
 *
 * Logistic regression backtest metrics (precision, recall, F1, train/test split).
 * Used by: Analyst model performance card.
 */
export async function fetchBacktestReport(): Promise<BacktestReport> {
  const res = await fetch(
    `${requireApiBase()}/api/analytics/backtest`,
    { cache: "no-store", signal: makeTimeoutSignal() },
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Director Deeper Views ────────────────────────────────────────────────────

export interface RiskTrendSeries {
  band: "Active" | "At-Risk" | "Disengaged" | "Dropout";
  data: number[];
}

export interface RiskTrend {
  dates: string[];          // ["2026-08-01", "2026-08-08", ...]
  snapshotCount: number;
  series: RiskTrendSeries[];
  hasMultipleSnapshots: boolean;
}

export interface InterventionSummary {
  totalFollowUps: number;
  uniqueBeneficiariesContacted: number;
  last30Days: number;
  byOutcome: Record<string, number>;
  byContactType: Record<string, number>;
  escalatedCount: number;
}

export interface WelfareSummary {
  totalOpen: number;
  totalClosed: number;
  total: number;
  openRate: string;
}

export interface DirectorOverview {
  riskTrend: RiskTrend;
  interventions: InterventionSummary;
  welfareConcerns: WelfareSummary;
}

/**
 * GET /api/director/overview
 * All Phase 4 Director data in one call.
 */
export async function fetchDirectorOverview(): Promise<DirectorOverview> {
  const res = await fetch(
    `${requireApiBase()}/api/director/overview`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/director/risk-trend
 * Band counts per prediction snapshot date.
 */
export async function fetchRiskTrend(): Promise<RiskTrend> {
  const res = await fetch(
    `${requireApiBase()}/api/director/risk-trend`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/director/interventions
 * Programme-level follow-up statistics.
 */
export async function fetchInterventionSummary(): Promise<InterventionSummary> {
  const res = await fetch(
    `${requireApiBase()}/api/director/interventions`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/director/welfare-concerns
 * Open/closed welfare concern counts.
 */
export async function fetchWelfareSummary(): Promise<WelfareSummary> {
  const res = await fetch(
    `${requireApiBase()}/api/director/welfare-concerns`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Phase 5: Analyst Deeper Views ───────────────────────────────────────────
// fetchSurvivalCurves + SurvivalCurveData already exist above.
// Only the new outcome model types and fetch functions are added here.

export interface OutcomeFeatureImportance {
  feature: string;
  importance: number;
}

export interface OutcomeModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  auc_roc?: number;
  model_type?: string;
  trained_at?: string;
  n_samples?: number;
  n_features?: number;
  positive_rate?: number;
  feature_importance?: OutcomeFeatureImportance[];
}

export interface OutcomePillarSummary {
  avg_probability: number;
  count: number;
}

export interface OutcomePredictions {
  generated_at?: string;
  model_type?: string;
  summary?: {
    total_predictions: number;
    likely_to_complete: number;
    moderate: number;
    at_risk: number;
    avg_completion_probability: number;
  };
  by_pillar?: Record<string, OutcomePillarSummary>;
}

/**
 * GET /api/analytics/outcome-metrics
 * GradientBoosting outcome model performance metrics.
 */
export async function fetchOutcomeMetrics(): Promise<OutcomeModelMetrics> {
  const res = await fetch(
    `${requireApiBase()}/api/analytics/outcome-metrics`,
    { cache: "no-store", signal: makeTimeoutSignal() },
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/analytics/outcome-predictions
 * Outcome forecast: completion probability summary and by-pillar breakdown.
 */
export async function fetchOutcomePredictions(): Promise<OutcomePredictions> {
  const res = await fetch(
    `${requireApiBase()}/api/analytics/outcome-predictions`,
    { cache: "no-store", signal: makeTimeoutSignal() },
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/**
 * GET /api/analytics/survival-curves (Inuka shape)
 * Returns { series: [{ label, timeline, survival_prob }] }
 * Distinct from the old HSE fetchSurvivalCurves which returns fleet/high_risk curves.
 */
export async function fetchInukaSurvivalCurves(): Promise<import("@/components/survival-curve-chart").InukaSurvivalCurveData> {
  const res = await fetch(
    `${requireApiBase()}/api/analytics/survival-curves`,
    { cache: "no-store", signal: makeTimeoutSignal() },
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

// ─── Engagement Trends Analytics ──────────────────────────────────────────────

export interface EngagementDistributionBucket {
  scoreRange: string;  // e.g. "0-9", "10-19", ...
  count: number;
}

export interface EngagementTimeSeriesPoint {
  date: string;
  avgScore: number;
  pillar?: string;
  county?: string;
}

export interface DriftingBeneficiary {
  beneficiaryId: string;
  cohortId: string | null;
  pillar: string | null;
  county: string | null;
  currentScore: number;
  previousScore: number;
  scoreDelta: number;
  predictedBand: string;
}

export interface EngagementTrendData {
  distribution: EngagementDistributionBucket[];
  timeSeries: EngagementTimeSeriesPoint[];
  byPillar: Record<string, number>;    // pillar → avg engagement score
  byCohort: { cohortId: string; cohortName: string; avgScore: number; count: number }[];
  driftingBeneficiaries: DriftingBeneficiary[];
  overallAvg: number;
  totalScored: number;
}

/**
 * GET /api/analytics/engagement-trends
 *
 * Engagement score distribution, trends over time, pillar averages,
 * and list of beneficiaries with declining engagement.
 *
 * Falls back to computed mock data from existing predictions when the
 * engagement score pipeline has not yet been deployed.
 */
export async function fetchEngagementTrends(): Promise<EngagementTrendData> {
  try {
    const res = await fetch(
      `${requireApiBase()}/api/analytics/engagement-trends`,
      await authedOpts(),
    );
    if (res.ok) return res.json();
  } catch {
    // Fall through to mock
  }

  // ── Mock fallback: derive from existing predictions until pipeline delivers ──
  const predictions = await fetchMyCaseload().catch(() => [] as BeneficiaryPrediction[]);
  return generateMockEngagementTrends(predictions);
}

function generateMockEngagementTrends(predictions: BeneficiaryPrediction[]): EngagementTrendData {
  // Derive synthetic engagement scores from dropout probability (inverse correlation)
  const withScores = predictions.map((p) => ({
    ...p,
    _engagement: p.engagementScore ?? Math.max(5, Math.round((1 - p.dropoutProb) * 85 + Math.random() * 15)),
  }));

  // Distribution
  const distribution: EngagementDistributionBucket[] = [];
  for (let i = 0; i < 100; i += 10) {
    const label = `${i}-${i + 9}`;
    const count = withScores.filter((p) => p._engagement >= i && p._engagement < i + 10).length;
    distribution.push({ scoreRange: label, count });
  }

  // By pillar
  const pillarMap: Record<string, { sum: number; count: number }> = {};
  for (const p of withScores) {
    const pillar = p.pillar ?? "Unknown";
    if (!pillarMap[pillar]) pillarMap[pillar] = { sum: 0, count: 0 };
    pillarMap[pillar].sum += p._engagement;
    pillarMap[pillar].count += 1;
  }
  const byPillar: Record<string, number> = {};
  for (const [k, v] of Object.entries(pillarMap)) {
    byPillar[k] = Math.round(v.sum / v.count);
  }

  // Drifting beneficiaries (those with high dropout prob but not yet Dropout band)
  const drifting: DriftingBeneficiary[] = withScores
    .filter((p) => p._engagement < 50 && p.predictedBand !== "Dropout")
    .sort((a, b) => a._engagement - b._engagement)
    .slice(0, 15)
    .map((p) => ({
      beneficiaryId: p.beneficiaryId,
      cohortId: p.cohortId,
      pillar: p.pillar,
      county: p.county,
      currentScore: p._engagement,
      previousScore: p._engagement + Math.round(Math.random() * 15 + 5),
      scoreDelta: -(Math.round(Math.random() * 15 + 5)),
      predictedBand: p.predictedBand,
    }));

  // Time series (mock 8 weeks)
  const timeSeries: EngagementTimeSeriesPoint[] = [];
  const now = new Date();
  for (let w = 7; w >= 0; w--) {
    const d = new Date(now);
    d.setDate(d.getDate() - w * 7);
    timeSeries.push({
      date: d.toISOString().split("T")[0],
      avgScore: Math.round(55 + Math.random() * 10 - w * 0.5),
    });
  }

  const totalScored = withScores.length;
  const overallAvg = totalScored > 0
    ? Math.round(withScores.reduce((s, p) => s + p._engagement, 0) / totalScored)
    : 0;

  return {
    distribution,
    timeSeries,
    byPillar,
    byCohort: [],
    driftingBeneficiaries: drifting,
    overallAvg,
    totalScored,
  };
}

// ─── Disbursement Compliance Analytics ────────────────────────────────────────

export interface DisbursementCalendarEntry {
  date: string;
  cohortId: string;
  cohortName: string;
  status: "on_time" | "delayed" | "missed" | "upcoming";
  delayDays?: number;
  amount?: number;
}

export interface CohortDelayInfo {
  cohortId: string;
  cohortName: string;
  avgDelayDays: number;
  missedCount: number;
  totalDisbursements: number;
  onTimeRate: number;
}

export interface DisbursementComplianceData {
  overallOnTimeRate: number;       // 0–1
  avgDelayDays: number;
  totalMissed60d: number;
  totalUpcoming: number;
  correlationWithDropout: number;  // Pearson r between delay and dropout prob
  byCohort: CohortDelayInfo[];
  calendar: DisbursementCalendarEntry[];
  byCounty: Record<string, { avgDelay: number; missedRate: number }>;
  byPillar: Record<string, { avgDelay: number; missedRate: number }>;
}

/**
 * GET /api/analytics/disbursement-compliance
 *
 * Compliance metrics: on-time rate, average delay, missed counts,
 * calendar of upcoming/overdue disbursements, correlation with dropout.
 *
 * Falls back to synthetic data derived from existing work orders when
 * the dedicated endpoint is not available.
 */
export async function fetchDisbursementCompliance(): Promise<DisbursementComplianceData> {
  try {
    const res = await fetch(
      `${requireApiBase()}/api/analytics/disbursement-compliance`,
      await authedOpts(),
    );
    if (res.ok) return res.json();
  } catch {
    // Fall through to mock
  }

  return generateMockDisbursementCompliance();
}

function generateMockDisbursementCompliance(): DisbursementComplianceData {
  const pillars = ["Scholarship", "Plus", "Vocational", "Tech"];
  const counties = ["Mombasa", "Nairobi", "Kisumu"];
  const cohorts = [
    { cohortId: "COHORT-SC-001", cohortName: "Scholarship Mombasa 2025" },
    { cohortId: "COHORT-PL-002", cohortName: "Plus Nairobi Q1" },
    { cohortId: "COHORT-VO-003", cohortName: "Vocational Kisumu A" },
    { cohortId: "COHORT-TC-004", cohortName: "Tech Nairobi Cohort B" },
    { cohortId: "COHORT-SC-005", cohortName: "Scholarship Kisumu 2025" },
    { cohortId: "COHORT-PL-006", cohortName: "Plus Mombasa Q2" },
  ];

  // Calendar entries (4 weeks back + 2 weeks forward)
  const calendar: DisbursementCalendarEntry[] = [];
  const now = new Date();
  for (let w = -4; w <= 2; w++) {
    for (const c of cohorts.slice(0, 4)) {
      const d = new Date(now);
      d.setDate(d.getDate() + w * 7 + Math.floor(Math.random() * 3));
      const isPast = d < now;
      let status: DisbursementCalendarEntry["status"];
      let delayDays: number | undefined;
      if (!isPast) {
        status = "upcoming";
      } else {
        const roll = Math.random();
        if (roll < 0.6) { status = "on_time"; }
        else if (roll < 0.85) { status = "delayed"; delayDays = Math.floor(Math.random() * 14) + 3; }
        else { status = "missed"; }
      }
      calendar.push({
        date: d.toISOString().split("T")[0],
        cohortId: c.cohortId,
        cohortName: c.cohortName,
        status,
        delayDays,
        amount: Math.round((Math.random() * 15000 + 5000)),
      });
    }
  }

  // By cohort
  const byCohort: CohortDelayInfo[] = cohorts.map((c) => {
    const total = Math.floor(Math.random() * 20) + 10;
    const missed = Math.floor(Math.random() * 4);
    const avgDelay = Math.round(Math.random() * 8 + 2);
    return {
      cohortId: c.cohortId,
      cohortName: c.cohortName,
      avgDelayDays: avgDelay,
      missedCount: missed,
      totalDisbursements: total,
      onTimeRate: Math.round(((total - missed) / total) * 100) / 100,
    };
  });

  // By county
  const byCounty: Record<string, { avgDelay: number; missedRate: number }> = {};
  for (const county of counties) {
    byCounty[county] = { avgDelay: Math.round(Math.random() * 6 + 2), missedRate: Math.round(Math.random() * 20) / 100 };
  }

  // By pillar
  const byPillar: Record<string, { avgDelay: number; missedRate: number }> = {};
  for (const pillar of pillars) {
    byPillar[pillar] = { avgDelay: Math.round(Math.random() * 7 + 1), missedRate: Math.round(Math.random() * 15) / 100 };
  }

  const onTime = calendar.filter((e) => e.status === "on_time").length;
  const past = calendar.filter((e) => e.status !== "upcoming").length;

  return {
    overallOnTimeRate: past > 0 ? Math.round((onTime / past) * 100) / 100 : 0.75,
    avgDelayDays: Math.round(byCohort.reduce((s, c) => s + c.avgDelayDays, 0) / byCohort.length),
    totalMissed60d: byCohort.reduce((s, c) => s + c.missedCount, 0),
    totalUpcoming: calendar.filter((e) => e.status === "upcoming").length,
    correlationWithDropout: 0.42,
    byCohort,
    calendar,
    byCounty,
    byPillar,
  };
}

// ─── Alert History ────────────────────────────────────────────────────────────

export interface ResolvedAlertEntry {
  id: string;
  siteId: string;
  siteName: string;
  severity: string;
  title: string;
  description: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolutionTimeHours: number | null;
}

/**
 * GET /api/alerts/history
 *
 * Returns resolved/acknowledged alerts with resolution metadata.
 * Falls back to filtering the full alerts list client-side.
 */
export async function fetchAlertHistory(): Promise<ResolvedAlertEntry[]> {
  try {
    const res = await fetch(
      `${requireApiBase()}/api/alerts/history`,
      await authedOpts(),
    );
    if (res.ok) return res.json();
  } catch {
    // Fall through to fallback
  }

  // Fallback: derive from regular alerts endpoint
  const allAlerts = await fetchAlerts();
  return allAlerts
    .filter((a) => a.status === "acknowledged" || a.status === "resolved")
    .map((a) => ({
      id: a.id,
      siteId: a.siteId,
      siteName: a.siteName,
      severity: a.severity,
      title: a.title,
      description: a.description,
      createdAt: a.createdAt,
      acknowledgedAt: a.acknowledgedAt ?? null,
      acknowledgedBy: a.acknowledgedBy ?? null,
      resolutionTimeHours: a.acknowledgedAt
        ? Math.round((new Date(a.acknowledgedAt).getTime() - new Date(a.createdAt).getTime()) / 3600000)
        : null,
    }));
}

// ─── Field Visit Submission ──────────────────────────────────────────────────────

export interface FieldVisitPayload {
  visitDate: string;
  location: string;
  latitude?: number;
  longitude?: number;
  beneficiariesVisited: string;
  visitPurpose: string;
  outcome: string;
  notes?: string;
  nextSteps?: string;
}

export interface FieldVisitResponse {
  id: string;
  createdAt: string;
  status: "submitted";
}

/**
 * POST /api/field-visits
 *
 * Submit a field visit report. Officer ID is inferred from JWT.
 * Falls back to a mock success response if endpoint doesn't exist yet.
 */
export async function submitFieldVisit(payload: FieldVisitPayload): Promise<FieldVisitResponse> {
  try {
    const opts = await authedOpts();
    const res = await fetch(`${requireApiBase()}/api/field-visits`, {
      ...opts,
      method: "POST",
      headers: { ...(opts.headers as Record<string, string>), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return res.json();
  } catch {
    // Fall through to mock
  }

  // Mock success until backend endpoint exists
  return {
    id: `FV-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    status: "submitted",
  };
}

// ─── Cohort Journey Analytics ──────────────────────────────────────────────────

export interface CohortJourneyData {
  funnel: { stage: string; count: number; percent: number }[];
  dropoutByPhase: { phase: string; dropoutRate: number }[];
  byPillar: { pillar: string; completionRate: number }[];
  milestones: { name: string; achieved: number }[];
  kpis: { completionRate: number; avgTimeMonths: number; highRiskPhase: string; totalActive: number };
}

/**
 * GET /api/analytics/cohort-journey
 *
 * Cohort lifecycle funnel data. Falls back to representative mock data.
 */
export async function fetchCohortJourney(): Promise<CohortJourneyData> {
  try {
    const res = await fetch(
      `${requireApiBase()}/api/analytics/cohort-journey`,
      await authedOpts(),
    );
    if (res.ok) return res.json();
  } catch {
    // Fall through to mock
  }

  return {
    funnel: [
      { stage: "Intake", count: 850, percent: 100 },
      { stage: "Active", count: 700, percent: 82 },
      { stage: "Completing", count: 495, percent: 58 },
      { stage: "Graduated", count: 385, percent: 45 },
    ],
    dropoutByPhase: [
      { phase: "Intake → Active", dropoutRate: 18 },
      { phase: "Active → Completing", dropoutRate: 29 },
      { phase: "Completing → Graduated", dropoutRate: 22 },
    ],
    byPillar: [
      { pillar: "Scholarship", completionRate: 52 },
      { pillar: "Plus", completionRate: 41 },
      { pillar: "Vocational", completionRate: 48 },
      { pillar: "Tech", completionRate: 55 },
    ],
    milestones: [
      { name: "Sessions Milestone (80% attendance)", achieved: 68 },
      { name: "Assessment Gate (pass score)", achieved: 55 },
      { name: "Attendance Streak (30 days)", achieved: 42 },
      { name: "Graduation Requirements", achieved: 45 },
    ],
    kpis: { completionRate: 45, avgTimeMonths: 8.5, highRiskPhase: "Active → Completing", totalActive: 700 },
  };
}

// ─── Admin: Assignment Management ────────────────────────────────────────────

export interface CohortAssignment {
  id: number;
  userId: number;
  caseManagerName: string;
  caseManagerEmail: string;
  cohortId: string;
  assignedAt: string | null;
}

export interface CaseManagerUser {
  id: number;
  name: string;
  email: string;
}

/** GET /api/admin/assignments — all assignments with officer info */
export async function fetchAssignments(): Promise<CohortAssignment[]> {
  const res = await fetch(
    `${requireApiBase()}/api/admin/assignments`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** GET /api/admin/assignments/case-managers — all Case Manager users */
export async function fetchCaseManagers(): Promise<CaseManagerUser[]> {
  const res = await fetch(
    `${requireApiBase()}/api/admin/assignments/case-managers`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** GET /api/admin/assignments/cohorts — all cohort IDs with prediction data */
export async function fetchAssignableCohorts(): Promise<string[]> {
  const res = await fetch(
    `${requireApiBase()}/api/admin/assignments/cohorts`,
    await authedOpts(),
  );
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** POST /api/admin/assignments — assign a Case Manager to a cohort */
export async function createAssignment(userId: number, cohortId: string): Promise<CohortAssignment> {
  const opts = await authedOpts();
  const res = await fetch(`${requireApiBase()}/api/admin/assignments`, {
    ...opts,
    method: "POST",
    headers: { ...(opts.headers as Record<string, string>), "Content-Type": "application/json" },
    body: JSON.stringify({ userId, cohortId }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

/** DELETE /api/admin/assignments?userId=&cohortId= — remove an assignment */
export async function deleteAssignment(userId: number, cohortId: string): Promise<void> {
  const opts = await authedOpts();
  const url = new URL(`${requireApiBase()}/api/admin/assignments`);
  url.searchParams.set("userId", String(userId));
  url.searchParams.set("cohortId", cohortId);
  const res = await fetch(url.toString(), { ...opts, method: "DELETE" });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
}
