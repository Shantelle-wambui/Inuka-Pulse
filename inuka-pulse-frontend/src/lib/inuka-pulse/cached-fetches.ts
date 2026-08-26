/**
 * React cache() wrappers for server-side data fetching.
 *
 * cache() deduplicates identical calls within the same render pass —
 * so layout.tsx and alerts/page.tsx can both call cachedFetchAlerts()
 * and only one HTTP request is made to the backend per page load.
 *
 * Must be imported by Server Components only (no "use client").
 * 
 * NOTE: These functions now return WithMockIndicator<T> wrappers.
 * Always check the `isMock` flag and display MockDataBanner when true.
 */

import { cache } from "react";
import { fetchAlerts, fetchQualitySummary, fetchRiskSummary, fetchTelemetrySummary, fetchBatches, fetchSiteNameMap } from "./api";

// These return WithMockIndicator<T> wrappers — check isMock flag!
export const cachedFetchAlerts          = cache(fetchAlerts);
export const cachedFetchQualitySummary  = cache(fetchQualitySummary);
export const cachedFetchRiskSummary     = cache(fetchRiskSummary);
export const cachedFetchBatches         = cache(fetchBatches);

// These don't use mock fallback
export const cachedFetchTelemetrySummary = cache(fetchTelemetrySummary);

// siteId → siteName lookup map (derived from risk-summary); used by
// technicians, nearby-alerts, diagnostics, and site risk-profile pages.
export const cachedFetchSiteNameMap = cache(fetchSiteNameMap);
