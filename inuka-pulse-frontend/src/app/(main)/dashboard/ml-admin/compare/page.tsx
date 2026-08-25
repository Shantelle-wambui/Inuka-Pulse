import { ModelCompareView } from "./_components/model-compare-view";

export default function ModelComparePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Champion vs. Challenger</h1>
        <p className="text-muted-foreground text-sm">
          Compare model performance across all prediction families. Select a model family
          to view champion metrics alongside any challenger candidates awaiting promotion.
        </p>
      </div>
      <ModelCompareView />
    </div>
  );
}
