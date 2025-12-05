-- Migration: 009_workflow_templates.sql
-- Workflow Templates for Visual Workflow Builder

-- ============================================
-- 1. Workflow Templates Table
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    -- Workflow definition
    category VARCHAR(50) DEFAULT 'custom', -- 'research', 'content', 'data', 'custom'
    trigger_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'scheduled', 'webhook', 'event'
    trigger_config JSONB DEFAULT '{}',
    -- Steps stored as JSON array
    steps JSONB NOT NULL DEFAULT '[]',
    -- Variables and inputs
    input_schema JSONB DEFAULT '{}', -- Define required inputs
    variables JSONB DEFAULT '{}', -- Default variable values
    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false, -- Share with team/public
    mode VARCHAR(20) DEFAULT 'Sales', -- Default mode
    max_steps INTEGER DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 300,
    -- Metadata
    icon VARCHAR(50) DEFAULT 'workflow',
    color VARCHAR(20) DEFAULT '#3B82F6',
    tags TEXT[] DEFAULT '{}',
    -- Stats
    run_count INTEGER DEFAULT 0,
    last_run_at TIMESTAMP,
    avg_duration_ms INTEGER,
    success_rate DECIMAL(5, 2) DEFAULT 100.00,
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_user ON workflow_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON workflow_templates(is_active);

-- ============================================
-- 2. Workflow Step Types Reference
-- ============================================
-- Steps stored in 'steps' JSONB column with structure:
-- {
--   "id": "step-uuid",
--   "type": "ai_prompt" | "tool_call" | "condition" | "loop" | "parallel" | "human_input" | "webhook",
--   "name": "Step Name",
--   "description": "What this step does",
--   "config": { ... type-specific config },
--   "position": { "x": 100, "y": 200 },
--   "connections": ["next-step-id"],
--   "onError": "stop" | "continue" | "retry",
--   "retryCount": 3,
--   "timeout": 60
-- }

-- ============================================
-- 3. Workflow Runs Table (extends workflow_executions)
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workflow_templates(template_id) ON DELETE CASCADE,
    execution_id UUID REFERENCES workflow_executions(execution_id) ON DELETE SET NULL,
    user_id VARCHAR(100) NOT NULL,
    -- Inputs and outputs
    inputs JSONB DEFAULT '{}',
    outputs JSONB DEFAULT '{}',
    -- Run state
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'paused', 'success', 'failed', 'cancelled'
    current_step_id VARCHAR(100),
    step_results JSONB DEFAULT '{}', -- Results keyed by step_id
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    -- Error handling
    error_step_id VARCHAR(100),
    error_message TEXT,
    -- Metadata
    triggered_by VARCHAR(50) DEFAULT 'manual', -- 'manual', 'schedule', 'webhook', 'api'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_template ON workflow_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_user ON workflow_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);

-- ============================================
-- 4. Workflow Schedules Table
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workflow_templates(template_id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    -- Schedule config
    cron_expression VARCHAR(100) NOT NULL, -- '0 9 * * 1' = Every Monday at 9am
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    -- Default inputs for scheduled runs
    default_inputs JSONB DEFAULT '{}',
    -- Tracking
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_template ON workflow_schedules(template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_run ON workflow_schedules(next_run_at) WHERE is_active = true;

-- ============================================
-- 5. Seed Default Templates
-- ============================================

INSERT INTO workflow_templates (user_id, name, description, category, steps, input_schema, icon, color, tags, is_public)
VALUES 
    -- Research Assistant
    ('system', 'Research Assistant', 'Research a topic using web search and summarize findings', 'research',
     '[
        {"id": "1", "type": "ai_prompt", "name": "Generate Search Queries", "config": {"prompt": "Generate 3 search queries for: {{topic}}"}, "connections": ["2"]},
        {"id": "2", "type": "tool_call", "name": "Web Search", "config": {"tool": "tavily_search", "params": {"query": "{{step_1_output}}"}}, "connections": ["3"]},
        {"id": "3", "type": "ai_prompt", "name": "Summarize Results", "config": {"prompt": "Summarize these search results:\n{{step_2_output}}"}, "connections": []}
     ]'::jsonb,
     '{"topic": {"type": "string", "required": true, "description": "Topic to research"}}'::jsonb,
     'search', '#10B981', ARRAY['research', 'ai'], true),
    
    -- Content Generator
    ('system', 'Blog Post Generator', 'Generate a blog post with outline, draft, and polish', 'content',
     '[
        {"id": "1", "type": "ai_prompt", "name": "Create Outline", "config": {"prompt": "Create a detailed outline for a blog post about: {{title}}"}, "connections": ["2"]},
        {"id": "2", "type": "ai_prompt", "name": "Write Draft", "config": {"prompt": "Write a blog post following this outline:\n{{step_1_output}}"}, "connections": ["3"]},
        {"id": "3", "type": "ai_prompt", "name": "Polish & Edit", "config": {"prompt": "Polish and improve this blog post for clarity and engagement:\n{{step_2_output}}"}, "connections": []}
     ]'::jsonb,
     '{"title": {"type": "string", "required": true, "description": "Blog post title"}}'::jsonb,
     'file-text', '#8B5CF6', ARRAY['content', 'writing'], true),
    
    -- Data Processor
    ('system', 'Document Analyzer', 'Analyze a document and extract key information', 'data',
     '[
        {"id": "1", "type": "tool_call", "name": "Fetch Document", "config": {"tool": "rag_search", "params": {"query": "{{query}}"}}, "connections": ["2"]},
        {"id": "2", "type": "ai_prompt", "name": "Extract Information", "config": {"prompt": "Extract key information from this document:\n{{step_1_output}}\n\nFocus on: {{focus_areas}}"}, "connections": ["3"]},
        {"id": "3", "type": "ai_prompt", "name": "Generate Summary", "config": {"prompt": "Create a structured summary:\n{{step_2_output}}"}, "connections": []}
     ]'::jsonb,
     '{"query": {"type": "string", "required": true}, "focus_areas": {"type": "string", "default": "main topics, key findings, action items"}}'::jsonb,
     'file-search', '#F59E0B', ARRAY['data', 'analysis'], true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. Update function for template stats
-- ============================================

CREATE OR REPLACE FUNCTION update_template_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('success', 'failed') AND OLD.status = 'running' THEN
        UPDATE workflow_templates
        SET 
            run_count = run_count + 1,
            last_run_at = NOW(),
            avg_duration_ms = (
                SELECT AVG(duration_ms) 
                FROM workflow_runs 
                WHERE template_id = NEW.template_id AND duration_ms IS NOT NULL
            ),
            success_rate = (
                SELECT (COUNT(*) FILTER (WHERE status = 'success') * 100.0 / NULLIF(COUNT(*), 0))
                FROM workflow_runs
                WHERE template_id = NEW.template_id AND status IN ('success', 'failed')
            ),
            updated_at = NOW()
        WHERE template_id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_template_stats ON workflow_runs;
CREATE TRIGGER tr_update_template_stats
    AFTER UPDATE ON workflow_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_template_stats();

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON TABLE workflow_templates IS 'User-defined workflow templates with visual builder support';
COMMENT ON TABLE workflow_runs IS 'Individual executions of workflow templates';
COMMENT ON TABLE workflow_schedules IS 'Scheduled execution configuration for workflows';
