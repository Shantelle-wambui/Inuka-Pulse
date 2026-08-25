"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
const POLL_INTERVAL_MS = 15_000; // 15 s
const ALERT_SEVERITIES = new Set(["Critical", "High"]);
const KNOWN_ALERTS_STORAGE_KEY = "inuka_known_alert_ids";

export interface NewAlertInfo {
  id: string;
  siteId: string;
  siteName: string;
  severity: string;
  title: string;
}

interface UseInukaAlertsResult {
  newAlerts: NewAlertInfo[];
  activeCount: number;
  clearNew: () => void;
}

/**
 * Load known alert IDs from localStorage.
 * Returns an empty Set if localStorage is unavailable or corrupted.
 */
function loadKnownIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(KNOWN_ALERTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch {
    // Corrupted data — start fresh
    console.warn("Failed to parse known alert IDs from localStorage");
  }
  return new Set();
}

/**
 * Persist known alert IDs to localStorage.
 * Limits storage to the most recent 500 IDs to prevent unbounded growth.
 */
function saveKnownIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    // Keep only the most recent 500 IDs to prevent unbounded growth
    const idsArray = Array.from(ids);
    const trimmed = idsArray.slice(-500);
    localStorage.setItem(KNOWN_ALERTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — non-critical, continue without persistence
    console.warn("Failed to persist known alert IDs to localStorage");
  }
}

/**
 * useInukaAlerts — v4
 *
 * Triggers sound when a NEW Critical/High alert ID appears that wasn't
 * present on the previous poll OR in persistent storage.
 *
 * In the Inuka context, Critical = dropout risk confirmed / beneficiary
 * disengaged, High = early-warning flags requiring program officer action.
 *
 * v4 improvements over v3:
 *  - Known alert IDs are persisted to localStorage, so if a user closes
 *    the browser and returns a week later, they won't hear sounds for
 *    alerts they were already notified about.
 *  - Storage is trimmed to 500 IDs max to prevent unbounded growth.
 *
 * Operational behaviour:
 *  - Sound fires once when a new beneficiary alert is raised (new risk detected)
 *  - Goes quiet while the same alert stays active (officer already knows)
 *  - Fires again only if the alert is resolved and a NEW one is raised
 *  - Does NOT fire for old alerts when user returns after absence
 *
 * Strategy:
 *   1. On mount, load known alert IDs from localStorage
 *   2. Poll /api/alerts every 15 seconds
 *   3. On first fetch, merge current active alerts into known set (seed)
 *   4. On subsequent fetches, find Critical/High alert IDs not in known set
 *   5. Fire sound for those genuinely new alerts
 *   6. Persist updated known set to localStorage
 */
export function useInukaAlerts(): UseInukaAlertsResult {
  const [newAlerts, setNewAlerts]   = useState<NewAlertInfo[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  // Set of alert IDs we have already notified about — initialized from localStorage
  const knownIds     = useRef<Set<string>>(loadKnownIds());
  const isFirstFetch = useRef(true);

  function authHeaders(): HeadersInit {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("inuka_token") ?? "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const poll = useCallback(async () => {
    if (!API_BASE) return;
    try {
      const res = await fetch(`${API_BASE}/api/alerts`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) return;

      const alerts: Array<{
        id: string; siteId: string; siteName: string;
        severity: string; status: string; title: string;
      }> = await res.json();

      const activeAlerts  = alerts.filter((a) => a.status === "active");
      const dangerousAlerts = activeAlerts.filter((a) =>
        ALERT_SEVERITIES.has(a.severity)
      );

      setActiveCount(activeAlerts.length);

      if (isFirstFetch.current) {
        // Seed — record all current IDs silently, no sound on page load
        // This ensures returning users don't hear sounds for existing alerts
        dangerousAlerts.forEach((a) => knownIds.current.add(a.id));
        saveKnownIds(knownIds.current);
        isFirstFetch.current = false;
        return;
      }

      // Find alerts whose ID we have never seen before (not in persistent storage)
      const brandNew = dangerousAlerts.filter(
        (a) => !knownIds.current.has(a.id)
      );

      // Add them to known so we don't fire again on the next poll
      brandNew.forEach((a) => knownIds.current.add(a.id));
      
      // Persist updated known IDs to localStorage
      if (brandNew.length > 0) {
        saveKnownIds(knownIds.current);
        setNewAlerts(
          brandNew.map((a) => ({
            id: a.id,
            siteId: a.siteId,
            siteName: a.siteName,
            severity: a.severity,
            title: a.title,
          }))
        );
      }
    } catch {
      // Silent — network errors don't crash the sound system
    }
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  const clearNew = useCallback(() => setNewAlerts([]), []);

  return { newAlerts, activeCount, clearNew };
}
