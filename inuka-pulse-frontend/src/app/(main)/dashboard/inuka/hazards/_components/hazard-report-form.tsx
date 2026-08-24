"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, AlertTriangle, ShieldAlert } from "lucide-react";

const CATEGORIES = ["Disengagement", "Missed Disbursement", "Assessment Gap", "Field Visit Overdue", "Data Quality Issue", "Other"];
const SITES = [
  { id: "cohort-sc-001", name: "Scholarship — Nairobi" },
  { id: "cohort-sc-002", name: "Scholarship — Mombasa" },
  { id: "cohort-pl-001", name: "Plus — Nairobi" },
  { id: "cohort-pl-007", name: "Plus — Kisumu" },
  { id: "cohort-vn-003", name: "Vocational — Nakuru" },
  { id: "cohort-vn-008", name: "Vocational — Eldoret" },
  { id: "cohort-tc-002", name: "Tech — Nairobi" },
];

const API_BASE = process.env.NEXT_PUBLIC_INUKA_API_URL ?? "";

export function HazardReportForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    siteId: "", category: "", description: "", severityEstimate: "Medium", photoUrl: "",
    reportType: "hazard" as "hazard" | "near_miss",
  });

  const handleSubmit = async () => {
    if (!form.siteId || !form.category || !form.description) {
      toast.error("Cohort, category, and description are required.");
      return;
    }
    setLoading(true);
    try {
      const token = document.cookie.match(/inuka-token=([^;]+)/)?.[1];
      const res = await fetch(`${API_BASE}/api/hazard-reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Welfare concern submitted successfully.");
      setOpen(false);
      setForm({ siteId: "", category: "", description: "", severityEstimate: "Medium", photoUrl: "", reportType: "hazard" });
      router.refresh();
    } catch (e: any) {
      toast.error(`Failed to submit: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="default" className="px-5 py-2.5">
          <Plus className="mr-2 size-4" /> Raise Concern
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="size-5 text-primary" />
            Raise a Welfare Concern
          </DialogTitle>
          <DialogDescription className="text-sm">
            Flag a safeguarding issue, disengagement risk, or programme concern for review by the Programme team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* Report type toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Report Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "hazard", label: "Welfare Concern", icon: ShieldAlert, desc: "Safeguarding or wellbeing issue" },
                { value: "near_miss", label: "Escalation", icon: AlertTriangle, desc: "Requires urgent attention" },
              ] as const).map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, reportType: value }))}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 text-center transition-all ${
                    form.reportType === value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`size-5 ${form.reportType === value ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cohort & Category — side by side on desktop */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cohort <span className="text-destructive">*</span></Label>
              <Select value={form.siteId} onValueChange={(v) => setForm((f) => ({ ...f, siteId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {SITES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Description <span className="text-destructive">*</span></Label>
            <Textarea
              rows={4}
              placeholder="Describe the concern — what did you observe? Who is affected? What action has been taken so far?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="resize-none"
            />
          </div>

          {/* Severity & Photo — side by side */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Severity <span className="text-destructive">*</span></Label>
              <Select value={form.severityEstimate} onValueChange={(v) => setForm((f) => ({ ...f, severityEstimate: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">🟢 Low — Monitor</SelectItem>
                  <SelectItem value="Medium">🟡 Medium — Follow up within 48h</SelectItem>
                  <SelectItem value="High">🔴 High — Immediate action required</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Photo URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="https://..."
                value={form.photoUrl}
                onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 border-t">
            <Button onClick={handleSubmit} disabled={loading} className="w-full py-2.5 text-sm font-medium">
              {loading ? "Submitting…" : "Submit Concern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
