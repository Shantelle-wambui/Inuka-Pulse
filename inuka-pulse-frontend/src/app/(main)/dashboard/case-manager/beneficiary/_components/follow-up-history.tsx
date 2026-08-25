"use client";

import { useState } from "react";
import { Clock, Phone, Home, MessageSquare, Mail, MoreHorizontal, CheckCircle2, AlertTriangle, XCircle, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BeneficiaryFollowUp } from "@/lib/inuka-pulse/api";

interface FollowUpHistoryProps {
  initialHistory: BeneficiaryFollowUp[];
}

const CONTACT_ICONS: Record<string, React.ElementType> = {
  phone_call: Phone,
  home_visit: Home,
  sms:        MessageSquare,
  email:      Mail,
  other:      MoreHorizontal,
};

const OUTCOME_STYLES: Record<string, { icon: React.ElementType; className: string }> = {
  reached:      { icon: CheckCircle2, className: "text-green-600  dark:text-green-400" },
  no_answer:    { icon: XCircle,      className: "text-muted-foreground" },
  left_message: { icon: MessageCircle,className: "text-amber-600  dark:text-amber-400" },
  escalated:    { icon: AlertTriangle,className: "text-red-600    dark:text-red-400" },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
}

export function FollowUpHistory({ initialHistory }: FollowUpHistoryProps) {
  // Accept optimistic updates from the RecordFollowUpForm via parent
  const [history] = useState<BeneficiaryFollowUp[]>(initialHistory);

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4" />
            Follow-up History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-28 text-muted-foreground gap-2">
          <Clock className="size-6 opacity-30" />
          <p className="text-sm">No follow-ups recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4" />
            Follow-up History
          </CardTitle>
          <Badge variant="outline" className="text-xs">{history.length} record{history.length !== 1 ? "s" : ""}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {history.map((f) => {
            const ContactIcon = CONTACT_ICONS[f.contactType] ?? MoreHorizontal;
            const outcomeStyle = OUTCOME_STYLES[f.outcome] ?? OUTCOME_STYLES.reached;
            const OutcomeIcon = outcomeStyle.icon;

            return (
              <div key={f.id} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 rounded-full bg-muted p-1.5">
                    <ContactIcon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{f.contactTypeLabel}</span>
                      <span className={`flex items-center gap-1 text-xs ${outcomeStyle.className}`}>
                        <OutcomeIcon className="size-3" />
                        {f.outcomeLabel}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {formatDate(f.followUpDate)}
                      </span>
                    </div>

                    {/* Notes */}
                    {f.notes && (
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">{f.notes}</p>
                    )}

                    {/* Next action */}
                    {f.nextAction && (
                      <p className="text-xs mt-1.5 text-primary/80 bg-primary/5 rounded px-2 py-1">
                        Next: {f.nextAction}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
