-- Migration: 007_audit_schema_update.sql
-- Adds missing columns for general application audit logging
-- Also adds updated_at to documents table

-- ============================================
-- 1. Add missing columns to audit_logs table
-- ============================================

-- Add 'action' column (for general actions like 'document.upload', 'tag.create')
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100);

-- Add 'resource' column (for resource type: 'document', 'project', 'tag', etc.)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource VARCHAR(50);

-- Add 'resource_id' column (for the ID of the affected resource)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(100);

-- Add 'ip_address' column (for tracking request origin)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);

-- Add 'user_agent' column (for tracking client info)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);

-- ============================================
-- 2. Add updated_at to documents table
-- ============================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create trigger for documents updated_at
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Update existing NULL values
-- ============================================

-- Set default values for any existing rows that have NULL in new columns
UPDATE audit_logs SET action = action_type WHERE action IS NULL AND action_type IS NOT NULL;
UPDATE audit_logs SET resource = 'workflow' WHERE resource IS NULL AND execution_id IS NOT NULL;
UPDATE audit_logs SET ip_address = 'unknown' WHERE ip_address IS NULL;
UPDATE audit_logs SET user_agent = 'unknown' WHERE user_agent IS NULL;

-- Set updated_at for existing documents
UPDATE documents SET updated_at = uploaded_at WHERE updated_at IS NULL;

-- ============================================
-- 4. Comments
-- ============================================

COMMENT ON COLUMN audit_logs.action IS 'General action name: document.upload, tag.create, settings.update, etc.';
COMMENT ON COLUMN audit_logs.resource IS 'Resource type: document, project, tag, settings, chat, etc.';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected resource (document ID, project ID, etc.)';
COMMENT ON COLUMN audit_logs.ip_address IS 'Client IP address for security tracking';
COMMENT ON COLUMN audit_logs.user_agent IS 'Client user agent string';

-- ============================================
-- Migration Complete
-- ============================================
