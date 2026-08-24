import { FieldVisitFormView } from "./_components/field-visit-form-view";

export default function FieldVisitFormPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
          Submit Field Visit
        </h1>
        <p className="text-muted-foreground text-sm">
          Record a field visit to one or more beneficiaries. GPS location is captured automatically when available.
        </p>
      </div>
      <FieldVisitFormView />
    </div>
  );
}
