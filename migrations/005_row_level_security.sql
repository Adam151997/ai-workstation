-- Migration: Row-Level Security (RLS) Policies
-- Phase 3: Enterprise-grade data isolation
-- Run via: http://localhost:3000/api/setup/row-level-security

-- ============================================
-- Overview
-- ============================================
-- RLS ensures users can only access their own data
-- Even if application code has bugs, database enforces isolation
-- This is defense-in-depth security

-- ============================================
-- 1. Enable RLS on all user-facing tables
-- ============================================

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Document chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Document tags
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;

-- Workflow executions
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Workflow steps
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

-- Audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Observability metrics
ALTER TABLE observability_metrics ENABLE ROW LEVEL SECURITY;

-- Billing records
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Create application role for RLS
-- ============================================
-- The app connects as this role and sets user_id per request

DO $$
BEGIN
    -- Create role if not exists
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN;
    END IF;
END
$$;

-- Grant necessary permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunks TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tags TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_tags TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_executions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_steps TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON observability_metrics TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_records TO app_user;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================
-- 3. Create RLS policies for documents
-- ============================================

DROP POLICY IF EXISTS documents_isolation ON documents;
CREATE POLICY documents_isolation ON documents
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- 4. Create RLS policies for document_chunks
-- ============================================
-- Chunks inherit access from parent document

DROP POLICY IF EXISTS document_chunks_isolation ON document_chunks;
CREATE POLICY document_chunks_isolation ON document_chunks
    FOR ALL
    USING (
        document_id IN (
            SELECT id FROM documents 
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );

-- ============================================
-- 5. Create RLS policies for projects
-- ============================================

DROP POLICY IF EXISTS projects_isolation ON projects;
CREATE POLICY projects_isolation ON projects
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- 6. Create RLS policies for tags
-- ============================================

DROP POLICY IF EXISTS tags_isolation ON tags;
CREATE POLICY tags_isolation ON tags
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- 7. Create RLS policies for document_tags
-- ============================================
-- Must own both the document AND the tag

DROP POLICY IF EXISTS document_tags_isolation ON document_tags;
CREATE POLICY document_tags_isolation ON document_tags
    FOR ALL
    USING (
        document_id IN (
            SELECT id FROM documents 
            WHERE user_id = current_setting('app.current_user_id', true)
        )
        AND
        tag_id IN (
            SELECT id FROM tags 
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );

-- ============================================
-- 8. Create RLS policies for workflow_executions
-- ============================================

DROP POLICY IF EXISTS workflow_executions_isolation ON workflow_executions;
CREATE POLICY workflow_executions_isolation ON workflow_executions
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- 9. Create RLS policies for workflow_steps
-- ============================================
-- Steps inherit access from parent execution

DROP POLICY IF EXISTS workflow_steps_isolation ON workflow_steps;
CREATE POLICY workflow_steps_isolation ON workflow_steps
    FOR ALL
    USING (
        execution_id IN (
            SELECT execution_id FROM workflow_executions 
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );

-- ============================================
-- 10. Create RLS policies for audit_logs
-- ============================================

DROP POLICY IF EXISTS audit_logs_isolation ON audit_logs;
CREATE POLICY audit_logs_isolation ON audit_logs
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- 11. Create RLS policies for observability_metrics
-- ============================================

DROP POLICY IF EXISTS observability_metrics_isolation ON observability_metrics;
CREATE POLICY observability_metrics_isolation ON observability_metrics
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- 12. Create RLS policies for billing_records
-- ============================================

DROP POLICY IF EXISTS billing_records_isolation ON billing_records;
CREATE POLICY billing_records_isolation ON billing_records
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- 13. Admin bypass policy (for maintenance)
-- ============================================
-- Superusers and the connection role bypass RLS by default
-- But we create explicit admin policies for the app_admin role

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin NOLOGIN;
    END IF;
END
$$;

-- Grant all permissions to admin
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_admin;

-- Admin bypasses RLS
ALTER ROLE app_admin BYPASSRLS;

-- ============================================
-- 14. Helper function to set current user
-- ============================================

CREATE OR REPLACE FUNCTION set_current_user_id(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 15. Helper function to get current user
-- ============================================

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 16. Verification view
-- ============================================

CREATE OR REPLACE VIEW rls_status AS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN (
    'documents', 'document_chunks', 'projects', 'tags', 'document_tags',
    'workflow_executions', 'workflow_steps', 'audit_logs', 
    'observability_metrics', 'billing_records'
);

-- ============================================
-- 17. Migration log
-- ============================================

INSERT INTO migrations_log (migration_name) 
VALUES ('005_row_level_security_v1')
ON CONFLICT DO NOTHING;

-- ============================================
-- Usage Notes
-- ============================================
-- 
-- In your application, before any query:
-- 1. Call: SELECT set_current_user_id('clerk_user_id_here');
-- 2. Then run your queries - RLS will filter automatically
--
-- Example in Node.js:
-- await query(`SELECT set_current_user_id($1)`, [userId]);
-- const docs = await query(`SELECT * FROM documents`); // Only user's docs
--
-- For admin/maintenance operations:
-- Connect as superuser or app_admin role to bypass RLS
