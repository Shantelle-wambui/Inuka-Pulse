"use client";

import { ReactNode } from "react";

/**
 * Layout for embeddable public widgets.
 * 
 * This layout:
 * - Has minimal chrome (no header/sidebar)
 * - Designed for iframe embedding on public websites
 * - Applies consistent Inuka branding
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      {children}
    </div>
  );
}
