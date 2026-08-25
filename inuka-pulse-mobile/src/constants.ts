// Inuka Foundation brand colours
export const Colors = {
  primary: "#00999E",       // Inuka teal
  accent: "#C42152",        // Inuka red
  background: "#F8F9FA",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",

  // Risk band colours
  riskActive: "#16A34A",       // green
  riskActiveLight: "#DCFCE7",
  riskAtRisk: "#D97706",       // amber
  riskAtRiskLight: "#FEF3C7",
  riskDisengaged: "#EA580C",   // orange
  riskDisengagedLight: "#FFEDD5",
  riskDropout: "#DC2626",      // red
  riskDropoutLight: "#FEE2E2",
};

// Point this at your backend.
// For local dev with Expo Go on a physical device, use your machine's LAN IP.
// e.g. http://192.168.1.x:8080
// For the hackathon demo with a deployed backend, use the full URL.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";
