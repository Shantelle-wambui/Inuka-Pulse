"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Home, MessageSquare, Mail, MoreHorizontal, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordFollowUp, type BeneficiaryFollowUp, type RecordFollowUpPayload } from "@/lib/inuka-pulse/api";

interface RecordFollowUpFormProps {
  beneficiaryId: string;
  onRecorded: (followUp: BeneficiaryFollowUp) => void;
}

const CONTACT_OPTIONS = [
  { value: "phone_call",  label: "Phone call",  icon: Phone },
  { value: "home_visit",  label: "Home visit",  icon: Home },
  { value: "sms",         label: "SMS",         icon: MessageSquare },
  { value: "email",       label: "Email",       icon: Mail },
  { value: "other",       label: "Other",       icon: MoreHorizontal },
];

const OUTCOME_OPTIONS = [
  { value: "reached",      label: "Reached — spoke with beneficiary" },
  { value: "no_answer",    label: "No answer" },
  { value: "left_message", label: "Left message / voicemail" },
  { value: "escalated",    label: "Escalated — welfare concern raised" },
];

export function RecordFollowUpForm({ beneficiaryId, onRecorded }: RecordFollowUpFormProps) {
  const router = useRouter();
  const [contactType, setContactType] = useState<RecordFollowUpPayload["contactType"]>("phone_call");
  const [outcome, setOutcome]         = useState<RecordFollowUpPayload["outcome"]>("reached");
  const [notes, setNotes]             = useState("");
  const [nextAction, setNextAction]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await recordFollowUp(beneficiaryId, {
        contactType,
        outcome,
        notes: notes.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
      });
      setSaved(true);
      setNotes("");
      setNextAction("");
      onRecorded(result);
      // Refresh server data after a short delay so the history list updates
      setTimeout(() => {
        router.refresh();
        setSaved(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="size-4" />
          Record Follow-up
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Contact type */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {CONTACT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setContactType(value as RecordFollowUpPayload["contactType"])}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors
                  ${contactType === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Outcome */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Outcome
            </label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as RecordFollowUpPayload["outcome"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Notes <span className="font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="What did you discuss? Any issues raised? Attendance reason?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Next action */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Next action <span className="font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="e.g. Schedule home visit on 28 Aug. Check attendance next week."
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          {/* Submit */}
          <Button type="submit" disabled={saving || saved} className="w-full sm:w-auto">
            {saved ? (
              <><CheckCircle2 className="size-4 mr-2 text-green-500" /> Saved</>
            ) : saving ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              "Save Follow-up"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
