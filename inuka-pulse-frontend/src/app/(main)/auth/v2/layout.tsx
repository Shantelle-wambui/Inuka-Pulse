import type { ReactNode } from "react";

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        {/* ── Side panel ───────────────────────────────────────────────── */}
        <div className="relative order-2 hidden h-full overflow-hidden rounded-3xl lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/login-background.svg"
            alt="Inuka Pulse dashboard — cohort risk map, dropout prediction scores, and live alerts across Kenya"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

          {/* ── Bottom overlay: Inuka branding ── */}
          <div className="absolute bottom-10 left-10 z-10 space-y-3">
            {/* Pill badges — 4 pillars */}
            <div className="flex flex-wrap gap-2">
              {["Scholarship", "Plus", "Vocational", "Tech"].map((pillar) => (
                <span
                  key={pillar}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-[11px] font-medium text-white/80 backdrop-blur-sm"
                >
                  {pillar}
                </span>
              ))}
            </div>

            <div className="h-0.5 w-12 rounded-full bg-white/40" />

            <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
              Beneficiary
              <br />
              Intelligence Platform
            </h2>
            <p className="text-sm text-white/60">
              Real-time M&E · Dropout prediction · Program impact tracking
            </p>

            <p className="pt-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Inuka Foundation · Program Impact Dashboard
            </p>
          </div>
        </div>

        {/* ── Login form panel ─────────────────────────────────────────── */}
        <div className="relative order-1 flex h-full">{children}</div>
      </div>
    </main>
  );
}
