import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Layers, Calendar, TrendingDown,
  AlertTriangle, CheckCircle2, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fetchBeneficiaryDetail, fetchFollowUps } from "@/lib/inuka-pulse/api";
import { RiskBandBadge } from "@/components/risk-band-badge";
import { EngagementBadge } from '@/components/engagement-badge';
import { RecordFollowUpForm } from "../_components/record-follow-up-form";
import { FollowUpHistory } from "../_components/follow-up-history";
import { WelfareConcernForm } from "../_components/welfare-concern-form";

const FEATURE_LABELS: Record<string, { label: string; detail: string }> = {
  attendance_rate_30d:      { label: "Low attendance rate",         detail: "Beneficiary has attended fewer sessions than expected in the past 30 days." },
  days_since_last_contact:  { label: "Long gap since last contact", detail: "It has been an unusually long time since anyone made contact with this beneficiary." },
  sessions_attended_30d:    { label: "Low sessions attended",       detail: "Fewer sessions attended in the past 30 days compared to programme expectations." },
  field_visit_gap_days:     { label: "Large field visit gap",       detail: "No field visit or in-person contact recorded recently." },
  disbursement_delay_days:  { label: "Delayed disbursement",        detail: "A payment to this beneficiary is overdue, which can cause disengagement." },
  missed_disbursements_60d: { label: "Missed disbursements",        detail: "One or more payments were not received in the past 60 days." },
  assessment_score_latest:  { label: "Low assessment score",        detail: "Recent academic or programme assessment score is below expected levels." },
  assessment_score_trend:   { label: "Declining assessment trend",  detail: "Assessment scores have been getting worse over recent evaluations." },
  missed_sessions_14d:      { label: "Recent absences",             detail: "Sessions missed in the past two weeks — a short-term warning sign." },
  no_contact_visits_90d:    { label: "No-contact visits",           detail: "Field visits in the past 90 days resulted in no contact with the beneficiary." },
};

function getFeatureInfo(raw: string) {
  const key = raw.trim();
  return FEATURE_LABELS[key] ?? { label: key.replace(/_/g, " "), detail: "" };
}

const BAND_CONFIG: Record<string, { icon: React.ElementType; color: string; description: string }> = {
  Active:     { icon: CheckCircle2, color: "text-green-600 dark:text-green-400",  description: "Participating normally with no significant warning signs." },
  "At-Risk":  { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", description: "Showing warning signs. Follow up soon to prevent further disengagement." },
  Disengaged: { icon: TrendingDown,  color: "text-orange-600 dark:text-orange-400", description: "Low engagement. Immediate outreach recommended." },
  Dropout:    { icon: TrendingDown,  color: "text-red-600 dark:text-red-400",     description: "High predicted dropout probability. Prioritise contact today." },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BeneficiaryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const beneficiaryId = decodeURIComponent(id);

  // Parallel fetch — prediction + follow-up history
  const [predResult, historyResult] = await Promise.allSettled([
    fetchBeneficiaryDetail(beneficiaryId),
    fetchFollowUps(beneficiaryId),
  ]);

  const beneficiary = predResult.status === "fulfilled" ? predResult.value : null;
  const history     = historyResult.status === "fulfilled" ? historyResult.value : [];

  if (!beneficiary) notFound();

  const bandConfig = BAND_CONFIG[beneficiary.predictedBand] ?? BAND_CONFIG["At-Risk"];
  const BandIcon   = bandConfig.icon;
  const features   = beneficiary.topFeaturesList ?? [];

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* ── Back link ── */}
      <Link
        href="/dashboard/case-manager"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="size-3.5" />
        Back to My Caseload
      </Link>

      {/* ── Header card ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

            {/* Identity */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-mono tracking-tight">
                  {beneficiary.beneficiaryId}
                </h1>
                <RiskBandBadge band={beneficiary.predictedBand} className="text-sm px-3 py-1" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {beneficiary.county && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {beneficiary.county}
                  </span>
                )}
                {beneficiary.pillar && (
                  <span className="flex items-center gap-1">
                    <Layers className="size-3.5" /> {beneficiary.pillar}
                  </span>
                )}
                {beneficiary.cohortId && (
                  <span className="flex items-center gap-1 font-mono text-xs">
                    {beneficiary.cohortId}
                  </span>
                )}
                {beneficiary.asOfDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" /> Predicted {beneficiary.asOfDate}
                  </span>
                )}
              </div>
            </div>

            {/* Risk score */}
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground mb-0.5">Predicted dropout risk</p>
              <p className={`text-4xl font-bold tabular-nums ${bandConfig.color}`}>
                {beneficiary.dropoutProbPct}
              </p>
            </div>
          </div>

          {/* Risk description */}
          <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 bg-muted/50 text-sm`}>
            <BandIcon className={`size-4 mt-0.5 shrink-0 ${bandConfig.color}`} />
            <p className="text-muted-foreground">{bandConfig.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Engagement Score ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4" />
            Engagement Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <EngagementBadge
            score={beneficiary.engagementScore ?? Math.round((1 - beneficiary.dropoutProb) * 85)}
            band={beneficiary.engagementBand ?? undefined}
          />
          <p className="text-xs text-muted-foreground">
            Composite index combining attendance, session activity, contact recency, and assessment trends
          </p>
        </CardContent>
      </Card>

      {/* ── Why they were flagged ── */}
      {features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" />
              Why they were flagged
            </CardTitle>
            <CardDescription className="text-xs">
              These are the factors the model identified as contributing to this beneficiary's
              dropout risk. They are indicators to investigate — not confirmed facts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {features.map((f, i) => {
              const info = getFeatureInfo(f);
              return (
                <div key={f} className="flex items-start gap-3">
                  <span className="shrink-0 flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{info.label}</p>
                    {info.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{info.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Welfare concern ── */}
      <WelfareConcernForm
        beneficiaryId={beneficiaryId}
        cohortId={beneficiary.cohortId}
      />

      {/* ── Record a follow-up ── */}
      <RecordFollowUpForm
        beneficiaryId={beneficiaryId}
        onRecorded={() => {}}
      />

      {/* ── Follow-up history ── */}
      <FollowUpHistory initialHistory={history} />

      {/* ── Disclaimer ── */}
      <p className="text-xs text-muted-foreground/60 border-t pt-3">
        Risk scores are generated by a predictive model and reflect statistical likelihood, not
        confirmed outcomes. Use this information to prioritise and guide your outreach — always
        verify with direct contact.
      </p>
    </div>
  );
}
