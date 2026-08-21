import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Inuka Pulse",
  version: packageJson.version,
  copyright: `© ${currentYear}, FTG — Future Technology Growth.`,
  meta: {
    title: "Inuka Pulse | Beneficiary Intelligence Platform",
    description:
      "Inuka Pulse is a real-time beneficiary intelligence platform built by FTG for the Inuka Foundation. " +
      "Monitor program engagement, predict dropout risk, and track impact across all four pillars.",
  },
};
