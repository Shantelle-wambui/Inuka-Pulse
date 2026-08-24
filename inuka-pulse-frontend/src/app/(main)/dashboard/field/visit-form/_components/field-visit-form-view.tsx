"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Loader2,
  Camera,
  Calendar,
  Users,
  ClipboardList,
} from "lucide-react";

const fieldVisitSchema = z.object({
  visitDate: z.string().min(1, "Visit date is required"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  beneficiariesVisited: z
    .string()
    .min(1, "At least one beneficiary ID is required"),
  visitPurpose: z.string().min(1, "Visit purpose is required"),
  outcome: z.string().min(1, "Outcome is required"),
  notes: z.string().optional(),
  nextSteps: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type FieldVisitFormData = z.infer<typeof fieldVisitSchema>;

type GpsStatus = "capturing" | "captured" | "unavailable";

export function FieldVisitFormView() {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("capturing");
  const [submitted, setSubmitted] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FieldVisitFormData>({
    resolver: zodResolver(fieldVisitSchema),
    defaultValues: {
      visitDate: today,
      location: "",
      beneficiariesVisited: "",
      visitPurpose: "",
      outcome: "",
      notes: "",
      nextSteps: "",
      latitude: undefined,
      longitude: undefined,
    },
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue("latitude", position.coords.latitude);
        setValue("longitude", position.coords.longitude);
        setGpsStatus("captured");
      },
      () => {
        setGpsStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [setValue]);

  const onSubmit = async (data: FieldVisitFormData) => {
    // Mock submission — in production this posts to the backend API
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Field visit submitted:", data);
    toast.success("Field visit report submitted successfully!", {
      description: `Visit to ${data.location} recorded for ${data.visitDate}.`,
    });

    setSubmitted(true);
    reset();
  };

  const handleNewVisit = () => {
    setSubmitted(false);
    reset({
      visitDate: today,
      location: "",
      beneficiariesVisited: "",
      visitPurpose: "",
      outcome: "",
      notes: "",
      nextSteps: "",
      latitude: watch("latitude"),
      longitude: watch("longitude"),
    });
  };

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
          <h2 className="text-xl font-semibold text-green-800 dark:text-green-200">
            Visit Report Submitted
          </h2>
          <p className="text-sm text-green-700 dark:text-green-300 text-center max-w-md">
            Your field visit has been recorded successfully. The data will be
            processed and reflected in the M&E dashboard shortly.
          </p>
          <Button onClick={handleNewVisit} className="mt-2">
            <ClipboardList className="h-4 w-4 mr-2" />
            Submit Another Visit
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Visit Date */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Visit Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="visitDate">Visit Date *</Label>
            <Input
              id="visitDate"
              type="date"
              {...register("visitDate")}
              max={today}
            />
            {errors.visitDate && (
              <p className="text-sm text-destructive">
                {errors.visitDate.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location / Area *</Label>
            <Input
              id="location"
              placeholder="e.g. Kibera Ward, Mathare Community"
              {...register("location")}
            />
            {errors.location && (
              <p className="text-sm text-destructive">
                {errors.location.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GPS Coordinates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            GPS Coordinates
            <GpsStatusBadge status={gpsStatus} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            GPS is auto-captured when available. You can also enter coordinates
            manually.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="-1.2921"
                {...register("latitude", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="36.8219"
                {...register("longitude", { valueAsNumber: true })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Beneficiaries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Beneficiaries Visited
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="beneficiariesVisited">Beneficiary IDs *</Label>
            <Textarea
              id="beneficiariesVisited"
              placeholder="Enter comma-separated beneficiary IDs, e.g. BEN-001, BEN-045, BEN-112"
              rows={3}
              {...register("beneficiariesVisited")}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple IDs with commas. Searchable multi-select coming
              soon.
            </p>
            {errors.beneficiariesVisited && (
              <p className="text-sm text-destructive">
                {errors.beneficiariesVisited.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visit Purpose & Outcome */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Purpose & Outcome
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="visitPurpose">Visit Purpose *</Label>
            <Select
              onValueChange={(value) => setValue("visitPurpose", value)}
              defaultValue=""
            >
              <SelectTrigger id="visitPurpose">
                <SelectValue placeholder="Select visit purpose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine_check">Routine Check</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="escalation_response">
                  Escalation Response
                </SelectItem>
                <SelectItem value="disbursement_verification">
                  Disbursement Verification
                </SelectItem>
                <SelectItem value="welfare_check">Welfare Check</SelectItem>
              </SelectContent>
            </Select>
            {errors.visitPurpose && (
              <p className="text-sm text-destructive">
                {errors.visitPurpose.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcome">Outcome *</Label>
            <Select
              onValueChange={(value) => setValue("outcome", value)}
              defaultValue=""
            >
              <SelectTrigger id="outcome">
                <SelectValue placeholder="Select visit outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_contacted">All Contacted</SelectItem>
                <SelectItem value="partial_contact">Partial Contact</SelectItem>
                <SelectItem value="no_contact">No Contact</SelectItem>
                <SelectItem value="beneficiary_absent">
                  Beneficiary Absent
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.outcome && (
              <p className="text-sm text-destructive">
                {errors.outcome.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes & Observations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Notes & Follow-up
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Observations</Label>
            <Textarea
              id="notes"
              placeholder="Describe what you observed during the visit..."
              rows={4}
              {...register("notes")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextSteps">Next Steps</Label>
            <Textarea
              id="nextSteps"
              placeholder="What follow-up actions are needed?"
              rows={3}
              {...register("nextSteps")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Evidence / Photos (placeholder) */}
      <Card className="opacity-60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Evidence / Photos
            <Badge variant="secondary" className="text-xs">
              Coming soon
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="file" disabled accept="image/*" multiple />
          <p className="text-xs text-muted-foreground mt-2">
            Photo upload will be available in a future update. Field officers
            will be able to attach evidence photos from their visits.
          </p>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submit Field Visit
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function GpsStatusBadge({ status }: { status: GpsStatus }) {
  switch (status) {
    case "capturing":
      return (
        <Badge
          variant="outline"
          className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
        >
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Capturing...
        </Badge>
      );
    case "captured":
      return (
        <Badge
          variant="outline"
          className="text-xs text-green-600 border-green-300 dark:text-green-400 dark:border-green-700"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Captured
        </Badge>
      );
    case "unavailable":
      return (
        <Badge
          variant="outline"
          className="text-xs text-red-600 border-red-300 dark:text-red-400 dark:border-red-700"
        >
          <MapPin className="h-3 w-3 mr-1" />
          Unavailable
        </Badge>
      );
  }
}
