-- Drop the existing constraint and recreate with new status values
ALTER TABLE pending_documents DROP CONSTRAINT IF EXISTS pending_documents_status_check;

ALTER TABLE pending_documents ADD CONSTRAINT pending_documents_status_check 
CHECK (status IN ('pending', 'awaiting_confirmation', 'auto_assigned', 'manually_assigned', 'rejected'));