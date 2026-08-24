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
  setTimeout(() => controller.abort(new Error(`Request timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
  return controller.signal;
}

/** Fetch options that include the JWT Authorization header. */
async function authedOpts(): Promise<RequestInit> {
  const token = await getAuthToken();
  return {
    cache: "no-store",
    signal: makeTimeoutSignal(),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
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

/** GET /api/sites/risk-summary */
export async function fetchRiskSummary(): Promise<SiteRiskSummary[]> {
  const res = await fetch(`${requireApiBase()}/api/sites/risk-summary`, await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: SiteRiskSummary[] = await res.json();
  // If backend has no Inuka cohorts seeded yet, fall back to mock data
  if (data.length === 0) return mockSites;
  return data;
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

/** GET /api/alerts */
export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch(`${requireApiBase()}/api/alerts`, await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: Alert[] = await res.json();
  // Fall back to mock data if backend returns no active Inuka alerts
  if (data.length === 0) return mockAlerts;
  return data;
}

/** POST /api/alerts/{id}/ack */
export async function acknowledgeAlert(id: string): Promise<void> {
  const opts = await authedOpts();
  const res = await fetch(`${requireApiBase()}/api/alerts/${id}/ack`, { ...opts, method: "POST" });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
}

// ─── Data Quality ─────────────────────────────────────────────────────────────

/** GET /api/quality/summary */
export async function fetchQualitySummary(): Promise<DataQualitySummary> {
  const res = await fetch(`${requireApiBase()}/api/quality/summary`, await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: DataQualitySummary = await res.json();
  // If total is 0 the DB has not been seeded — fall back to mock
  if (data.total === 0) return mockQualitySummary;
  return data;
}

/** GET /api/quality/batches */
export async function fetchBatches(): Promise<IngestBatch[]> {
  const res = await fetch(`${requireApiBase()}/api/quality/batches`, await authedOpts());
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const data: IngestBatch[] = await res.json();
  // If backend has no batches, fall back to mock batches
  if (data.length === 0) return mockBatches;
  return data;
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
