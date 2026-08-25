"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── API call ──────────────────────────────────────────────────────────────────

async function postWelfareConcern(payload: {
  beneficiaryId: string;
  cohortId: string;
  category: string;
  description: string;
  severityEstimate: string;
}) {
  const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";
  const res = await fetch(`${API_BASE}/api/hazard-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      siteId:           payload.cohortId,
      category:         payload.category,
      description:      payload.description,
      severityEstimate: payload.severityEstimate,
      reportType:       "welfare_concern",
      beneficiaryId:    payload.beneficiaryId,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "safety",        label: "Safety concern" },
  { value: "health",        label: "Health concern" },
  { value: "financial",     label: "Financial hardship" },
  { value: "family",        label: "Family / domestic situation" },
  { value: "mental_health", label: "Mental health" },
  { value: "other",         label: "Other" },
];

const SEVERITY_OPTIONS = [
  { value: "low",      label: "Low — monitor, no immediate action" },
  { value: "medium",   label: "Medium — follow up this week" },
  { value: "high",     label: "High — follow up today" },
  { value: "critical", label: "Critical — escalate now" },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface WelfareConcernFormProps {
  beneficiaryId: string;
  cohortId: string | null;
}

export function WelfareConcernForm({ beneficiaryId, cohortId }: WelfareConcernFormProps) {
  const router = useRouter();
  const [open, setOpen]             = useState(false);
  const [category, setCategory]     = useState("safety");
  const [severity, setSeverity]     = useState("medium");
  const [description, setDescription] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const canSubmit = !!cohortId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await postWelfareConcern({
        beneficiaryId,
        cohortId: cohortId!,
        category,
        description: description.trim(),
        severityEstimate: severity,
      });
      setSaved(true);
      setDescription("");
      setTimeout(() => {
        router.refresh();
        setSaved(false);
        setOpen(false);
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-200 dark:border-amber-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-500" />
              Welfare Concern
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Raise a safeguarding or welfare concern about this beneficiary.
              It will be escalated to the Programme Director.
            </CardDescription>
          </div>
          {!open && (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/30 shrink-0"
              onClick={() => setOpen(true)}
            >
              Raise concern
            </Button>
          )}
        </div>
      </CardHeader>

      {open && (
        <CardContent>
          {!canSubmit && (
            <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2 mb-3">
              This beneficiary has no cohort linked — contact an administrator.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Concern category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Severity */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Urgency
              </label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Description <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Describe the concern. What did you observe or hear? What action is needed?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="text-sm resize-none"
                required
              />
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-500" />
              Welfare concerns are routed to the Programme Director and logged permanently.
              Only raise this if you have a genuine safeguarding concern.
            </p>

            {/* Error */}
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={saving || saved || !canSubmit || !description.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {saved ? (
                  <><CheckCircle2 className="size-4 mr-2" /> Submitted</>
                ) : saving ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Submitting…</>
                ) : (
                  "Submit concern"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setOpen(false); setError(null); setDescription(""); }}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
