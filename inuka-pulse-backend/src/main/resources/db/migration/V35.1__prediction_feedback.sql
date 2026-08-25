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
