-- V33: Beneficiary Follow-up Log
--
-- Records every contact/intervention a Case Manager makes for a beneficiary.
-- This is the operational output of the dropout-risk prediction system:
--   ML flags a beneficiary as at-risk → Case Manager acts → logs outcome here.
--
-- Separate from capa (programme-level intervention plans) and hazard_report
-- (welfare escalations). This table is for day-to-day Case Manager contact notes.
--
-- One beneficiary can have many follow-ups over time (history preserved).

CREATE TABLE IF NOT EXISTS beneficiary_follow_up (
    id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    beneficiary_id   VARCHAR(50)  NOT NULL,
    officer_id       BIGINT       NOT NULL REFERENCES app_user(id),
    contact_type     VARCHAR(50)  NOT NULL,  -- phone_call | home_visit | sms | email | other
    outcome          VARCHAR(50)  NOT NULL,  -- reached | no_answer | left_message | escalated
    notes            TEXT         NULL,
    follow_up_date   DATE         NOT NULL,
    next_action      TEXT         NULL,      -- optional: what should happen next
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bfu_beneficiary ON beneficiary_follow_up(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_bfu_officer     ON beneficiary_follow_up(officer_id);
CREATE INDEX IF NOT EXISTS idx_bfu_date        ON beneficiary_follow_up(follow_up_date DESC);
