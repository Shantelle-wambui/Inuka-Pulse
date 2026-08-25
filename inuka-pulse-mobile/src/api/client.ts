import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../constants";

export const TOKEN_KEY = "inuka_jwt";

// ── Axios instance ────────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  name: string;
  email: string;
  role: string;
  userId: number;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/api/auth/login", {
    email,
    password,
  });
  return data;
}

// ── Beneficiaries ─────────────────────────────────────────────────────────────

export interface CaseloadSummary {
  total: number;
  needsAttention: number;
  atRisk: number;
  active: number;
  cohorts: string[];
  lastUpdated: string | null;
}

export interface Beneficiary {
  beneficiaryId: string;
  cohortId: string;
  pillar: string;
  county: string;
  asOfDate: string;
  dropoutProb: number;
  dropoutProbPct: string;
  predictedBand: string;
  riskLevel: string;
  topFeaturesList: string[];
  engagementScore: number;
  engagementBand: string;
}

export async function getCaseloadSummary(): Promise<CaseloadSummary> {
  const { data } = await api.get<CaseloadSummary>(
    "/api/beneficiaries/predictions/my-caseload/summary"
  );
  return data;
}

export async function getMyCaseload(): Promise<Beneficiary[]> {
  const { data } = await api.get<Beneficiary[]>(
    "/api/beneficiaries/predictions/my-caseload"
  );
  return data;
}

export async function getBeneficiary(id: string): Promise<Beneficiary> {
  const { data } = await api.get<Beneficiary>(`/api/beneficiaries/predictions/${id}`);
  return data;
}

// ── Follow-ups ────────────────────────────────────────────────────────────────

export interface FollowUp {
  id: number;
  beneficiaryId: string;
  officerId: number;
  contactType: string;
  contactTypeLabel: string;
  outcome: string;
  outcomeLabel: string;
  notes: string;
  followUpDate: string;
  nextAction: string;
  createdAt: string;
}

export interface RecordFollowUpRequest {
  contactType: string;
  outcome: string;
  notes?: string;
  followUpDate?: string;
  nextAction?: string;
}

export async function getFollowUps(beneficiaryId: string): Promise<FollowUp[]> {
  const { data } = await api.get<FollowUp[]>(
    `/api/beneficiaries/${beneficiaryId}/follow-ups`
  );
  return data;
}

export async function recordFollowUp(
  beneficiaryId: string,
  request: RecordFollowUpRequest
): Promise<FollowUp> {
  const { data } = await api.post<FollowUp>(
    `/api/beneficiaries/${beneficiaryId}/follow-ups`,
    request
  );
  return data;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  siteName: string;
  title: string;
  severity: string;
  status: string;
  rule: string;
  createdAt: string;
}

export async function getAlerts(): Promise<Alert[]> {
  const { data } = await api.get<Alert[]>("/api/alerts");
  return data;
}

// ── CAPAs (tasks) ─────────────────────────────────────────────────────────────

export interface Capa {
  id: number;
  description: string;
  status: string;
  dueDate: string;
  sourceAlertId: string | null;
}

export async function getMyCapas(): Promise<Capa[]> {
  const { data } = await api.get<Capa[]>("/api/capas");
  return data;
}
