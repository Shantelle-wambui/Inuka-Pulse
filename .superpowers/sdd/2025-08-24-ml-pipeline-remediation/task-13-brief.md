# Task 13: Create PredictionFeedbackWidget Component (Phase 7, Part 2)

## Files
- Create: `inuka-pulse-frontend/src/components/prediction-feedback-widget.tsx`
- Create: `inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/PredictionFeedbackEntity.java` (if not exists)
- Create: `inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/PredictionFeedbackRepository.java` (if not exists)
- Modify: `inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/BeneficiaryPredictionController.java`
- Create: `inuka-pulse-backend/src/main/resources/db/migration/V35__prediction_feedback.sql`

## Interfaces
Frontend:
- Input props: `beneficiaryId: string`, `predictionId?: number`
- Allows case managers to mark prediction as: Accurate, Inaccurate, Uncertain
- Optionally add a comment

Backend:
- `POST /api/beneficiaries/predictions/{beneficiaryId}/feedback`
- Request body: `{ rating: "accurate" | "inaccurate" | "uncertain", comment?: string }`
- Stores feedback for model improvement

## Context

ML models improve with feedback. This widget lets case managers indicate whether predictions were accurate, enabling:
1. Model calibration monitoring
2. Identification of systematic errors
3. Future retraining with ground truth

## Steps

### Step 1: Create database migration

Create `V35__prediction_feedback.sql`:

```sql
-- Prediction feedback from case managers for model improvement

CREATE TABLE IF NOT EXISTS prediction_feedback (
    id BIGSERIAL PRIMARY KEY,
    beneficiary_id VARCHAR(50) NOT NULL,
    prediction_date DATE NOT NULL,
    rating VARCHAR(20) NOT NULL CHECK (rating IN ('accurate', 'inaccurate', 'uncertain')),
    comment TEXT,
    submitted_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prediction_feedback_beneficiary ON prediction_feedback(beneficiary_id);
CREATE INDEX idx_prediction_feedback_rating ON prediction_feedback(rating);
```

### Step 2: Create PredictionFeedbackEntity

```java
package com.inukapulse.beneficiary;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "prediction_feedback")
@Data
@NoArgsConstructor
public class PredictionFeedbackEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "beneficiary_id", nullable = false, length = 50)
    private String beneficiaryId;

    @Column(name = "prediction_date", nullable = false)
    private LocalDate predictionDate;

    @Column(name = "rating", nullable = false, length = 20)
    private String rating;  // accurate, inaccurate, uncertain

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "submitted_by", length = 100)
    private String submittedBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
```

### Step 3: Create PredictionFeedbackRepository

```java
package com.inukapulse.beneficiary;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PredictionFeedbackRepository extends JpaRepository<PredictionFeedbackEntity, Long> {
    List<PredictionFeedbackEntity> findByBeneficiaryIdOrderByCreatedAtDesc(String beneficiaryId);
}
```

### Step 4: Add endpoint to controller

Add to `BeneficiaryPredictionController.java`:

```java
@Autowired
private PredictionFeedbackRepository feedbackRepository;

@PostMapping("/{beneficiaryId}/feedback")
public ResponseEntity<?> submitFeedback(
        @PathVariable String beneficiaryId,
        @RequestBody Map<String, String> body) {
    
    String rating = body.get("rating");
    if (rating == null || !List.of("accurate", "inaccurate", "uncertain").contains(rating)) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid rating"));
    }

    PredictionFeedbackEntity feedback = new PredictionFeedbackEntity();
    feedback.setBeneficiaryId(beneficiaryId);
    feedback.setPredictionDate(LocalDate.now());
    feedback.setRating(rating);
    feedback.setComment(body.get("comment"));
    // submittedBy could come from security context in production

    feedbackRepository.save(feedback);
    return ResponseEntity.ok(Map.of("status", "saved"));
}
```

### Step 5: Create frontend component

Create `prediction-feedback-widget.tsx`:

```tsx
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
    } catch (e) {
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
```

### Step 6: Verify compilation

Backend:
```bash
cd inuka-pulse-backend && ./mvnw compile -q
```

Frontend:
```bash
cd inuka-pulse-frontend && npx tsc --noEmit
```

### Step 7: Commit

```bash
git add inuka-pulse-backend/src/main/resources/db/migration/V35__prediction_feedback.sql \
        inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/PredictionFeedbackEntity.java \
        inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/PredictionFeedbackRepository.java \
        inuka-pulse-backend/src/main/java/com/inukapulse/beneficiary/BeneficiaryPredictionController.java \
        inuka-pulse-frontend/src/components/prediction-feedback-widget.tsx
git commit -m "feat: add prediction feedback widget for model improvement"
```
