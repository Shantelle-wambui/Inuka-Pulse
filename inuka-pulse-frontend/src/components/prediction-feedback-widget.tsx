"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, HelpCircle, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PredictionFeedbackWidgetProps {
  beneficiaryId: string;
}

type Rating = "accurate" | "inaccurate" | "uncertain" | null;

export function PredictionFeedbackWidget({ beneficiaryId }: PredictionFeedbackWidgetProps) {
  const [rating, setRating] = useState<Rating>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!rating) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/beneficiaries/predictions/${beneficiaryId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, comment: comment || undefined }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to submit feedback");
      }

      setSubmitted(true);
    } catch {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Thank you for your feedback!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Was this prediction accurate?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={rating === "accurate" ? "default" : "outline"}
            size="sm"
            onClick={() => setRating("accurate")}
            className={cn(
              rating === "accurate" && "bg-green-600 hover:bg-green-700"
            )}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Accurate
          </Button>
          <Button
            variant={rating === "inaccurate" ? "default" : "outline"}
            size="sm"
            onClick={() => setRating("inaccurate")}
            className={cn(
              rating === "inaccurate" && "bg-red-600 hover:bg-red-700"
            )}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            Inaccurate
          </Button>
          <Button
            variant={rating === "uncertain" ? "default" : "outline"}
            size="sm"
            onClick={() => setRating("uncertain")}
            className={cn(
              rating === "uncertain" && "bg-amber-600 hover:bg-amber-700"
            )}
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            Uncertain
          </Button>
        </div>

        {rating && (
          <>
            <Textarea
              placeholder="Optional: Add context about why this prediction was accurate or not..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="sm"
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
