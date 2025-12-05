-- Migration: Workflow Persistence Layer
-- Phase 0: Foundation Solidification
-- Migrates in-memory workflow store to PostgreSQL for data persistence
-- Run via: http://localhost:3000/api/setup/database or manually in Railway

-- ============================================
-- 1. Workflow Executions Table
-- ============================================
-- Tracks each workflow run with its overall status and metrics

CREATE TABLE IF NOT EXISTS workflow_executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name VARCHAR(200) NOT NULL,
    workflow_type VARCHAR(20) NOT NULL DEFAULT 'autonomous', -- 'autonomous', 'manual', 'template'
    user_id VARCHAR(100) NOT NULL, -- Clerk userId
    mode VARCHAR(20) NOT NULL, -- 'Sales', 'Marketing', 'Admin'
    model_id VARCHAR(100) NOT NULL,
    start_time TIMESTAMP NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed', 'partial', 'cancelled'
    total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    steps_total INTEGER NOT NULL DEFAULT 0,
    steps_completed INTEGER NOT NULL DEFAULT 0,
    steps_failed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workflow_exec_user ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_mode ON workflow_executions(mode);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_start_time ON workflow_executions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_user_status ON workflow_executions(user_id, status);

-- ============================================
-- 2. Workflow Steps Table
-- ============================================
-- Tracks individual steps within a workflow execution

CREATE TABLE IF NOT EXISTS workflow_steps (
    step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(execution_id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(200) NOT NULL,
    step_description TEXT,
    tool_name VARCHAR(100),
    tool_parameters JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'skipped'
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_ms INTEGER,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    result JSONB,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for step queries
CREATE INDEX IF NOT EXISTS idx_workflow_steps_execution ON workflow_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_tool ON workflow_steps(tool_name);

-- ============================================
-- 3. Audit Logs Table
-- ============================================
-- Complete audit trail of all system actions

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES workflow_executions(execution_id) ON DELETE SET NULL,
    step_id UUID REFERENCES workflow_steps(step_id) ON DELETE SET NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(30) NOT NULL, -- 'workflow_start', 'workflow_end', 'step_start', 'step_end', 'tool_call', 'ai_decision', 'error', 'retry', 'user_intervention'
    action_details TEXT NOT NULL,
    tool_name VARCHAR(100),
    tool_input JSONB,
    tool_output JSONB,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    model_id VARCHAR(100),
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_execution ON audit_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);

-- ============================================
-- 4. Observability Metrics Table
-- ============================================
-- Aggregated metrics for dashboards and analytics

CREATE TABLE IF NOT EXISTS observability_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id VARCHAR(100) NOT NULL,
    metric_type VARCHAR(30) NOT NULL, -- 'token_usage', 'cost', 'execution_time', 'error_rate', 'tool_success_rate', 'workflow_success_rate'
    metric_value DECIMAL(15, 4) NOT NULL,
    aggregation_period VARCHAR(10) NOT NULL DEFAULT 'hour', -- 'minute', 'hour', 'day', 'week', 'month'
    dimensions JSONB DEFAULT '{}', -- e.g., {model: 'gpt-4', mode: 'Sales', tool: 'hubspot'}
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for metrics queries
CREATE INDEX IF NOT EXISTS idx_metrics_user ON observability_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON observability_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON observability_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_period ON observability_metrics(aggregation_period);
CREATE INDEX IF NOT EXISTS idx_metrics_user_type_timestamp ON observability_metrics(user_id, metric_type, timestamp DESC);

-- ============================================
-- 5. Billing Records Table
-- ============================================
-- Tracks all billable usage for cost management

CREATE TABLE IF NOT EXISTS billing_records (
    billing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    execution_id UUID REFERENCES workflow_executions(execution_id) ON DELETE SET NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    model_id VARCHAR(100) NOT NULL,
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_total INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    billing_period VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
    paid BOOLEAN NOT NULL DEFAULT false,
    payment_id VARCHAR(100), -- Stripe payment ID if applicable
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for billing queries
CREATE INDEX IF NOT EXISTS idx_billing_user ON billing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_period ON billing_records(billing_period);
CREATE INDEX IF NOT EXISTS idx_billing_paid ON billing_records(paid);
CREATE INDEX IF NOT EXISTS idx_billing_user_period ON billing_records(user_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_billing_timestamp ON billing_records(timestamp DESC);

-- ============================================
-- 6. Helper Views
-- ============================================

-- User workflow summary view
CREATE OR REPLACE VIEW user_workflow_summary AS
SELECT 
    user_id,
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
    COUNT(*) FILTER (WHERE status = 'running') as running_executions,
    SUM(total_cost) as total_cost,
    SUM(total_tokens) as total_tokens,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE end_time IS NOT NULL) as avg_execution_time_ms,
    MAX(start_time) as last_execution_time
FROM workflow_executions
GROUP BY user_id;

-- Daily cost summary view
CREATE OR REPLACE VIEW daily_cost_summary AS
SELECT 
    user_id,
    DATE(timestamp) as date,
    model_id,
    SUM(cost) as total_cost,
    SUM(tokens_total) as total_tokens,
    COUNT(*) as record_count
FROM billing_records
GROUP BY user_id, DATE(timestamp), model_id
ORDER BY date DESC;

-- ============================================
-- 7. Update Trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON workflow_executions;
CREATE TRIGGER update_workflow_executions_updated_at
    BEFORE UPDATE ON workflow_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps;
CREATE TRIGGER update_workflow_steps_updated_at
    BEFORE UPDATE ON workflow_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_records_updated_at ON billing_records;
CREATE TRIGGER update_billing_records_updated_at
    BEFORE UPDATE ON billing_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Table Comments
-- ============================================

COMMENT ON TABLE workflow_executions IS 'Tracks each workflow run with overall status and cost metrics';
COMMENT ON TABLE workflow_steps IS 'Individual steps within a workflow execution';
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all system actions for compliance';
COMMENT ON TABLE observability_metrics IS 'Aggregated metrics for dashboards and analytics';
COMMENT ON TABLE billing_records IS 'Billable usage records for cost management';

COMMENT ON COLUMN workflow_executions.mode IS 'Agent mode: Sales, Marketing, or Admin';
COMMENT ON COLUMN workflow_executions.metadata IS 'Flexible JSON storage for workflow-specific data';
COMMENT ON COLUMN audit_logs.action_type IS 'Type of action: workflow_start, workflow_end, step_start, step_end, tool_call, ai_decision, error, retry, user_intervention';
COMMENT ON COLUMN billing_records.billing_period IS 'Month in YYYY-MM format for grouping invoices';

-- ============================================
-- 9. Migration Log Entry
-- ============================================

INSERT INTO migrations_log (migration_name) 
VALUES ('003_workflow_persistence_v1')
ON CONFLICT DO NOTHING;

-- ============================================
-- Migration Complete
-- ============================================
-- Run this migration via:
-- 1. Railway Console: Copy/paste into SQL editor
-- 2. API Endpoint: GET /api/setup/workflow-tables
-- 3. psql: psql $DATABASE_URL -f migrations/003_workflow_persistence.sql
