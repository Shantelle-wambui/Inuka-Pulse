-- V22: Rename 'Field Officer' role to 'Case Manager'
--
-- Rationale: the role was renamed in the application domain to better reflect
-- the operational responsibility of staff who manage individual beneficiary
-- caseloads, record follow-ups, and act on dropout risk predictions.
--
-- This migration is safe to run on existing data:
--   - app_user.role_id foreign key continues to point to the same row
--   - Only the display name in app_role changes
--   - JWT tokens issued before this migration will carry 'Field Officer' until
--     the user logs in again — acceptable since RouteGuard handles both

UPDATE app_role
SET    name        = 'Case Manager',
       description = 'Case Manager role — manages individual beneficiary caseloads, records follow-up actions, and acts on dropout risk predictions'
WHERE  name = 'Field Officer';
