-- migrations/007_notebooks.sql
-- Business Notebook System for AI Workstation OS
-- Phase 2A: Glass Cockpit + Visual Workflow

-- ============================================
-- NOTEBOOKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    
    -- Basic info
    title TEXT NOT NULL DEFAULT 'Untitled Notebook',
    description TEXT,
    icon TEXT DEFAULT '📓',
    
    -- Organization
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    
    -- Collaboration
    is_template BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    shared_with TEXT[] DEFAULT '{}',
    
    -- Execution state
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'completed', 'error')),
    last_run_at TIMESTAMPTZ,
    last_run_duration_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTEBOOK CELLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notebook_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    
    -- Position & Structure
    cell_index INTEGER NOT NULL,
    
    -- Cell Configuration
    cell_type TEXT NOT NULL DEFAULT 'command' CHECK (cell_type IN (
        'command',      -- Natural language command to execute
        'query',        -- Data retrieval / RAG query
        'transform',    -- Data transformation
        'visualize',    -- Generate chart/table/artifact
        'approve',      -- Human-in-the-loop gate
        'condition',    -- Branching logic
        'note'          -- Markdown notes (no execution)
    )),
    
    -- Content
    title TEXT,
    content TEXT NOT NULL,  -- The natural language command or markdown
    
    -- Dependencies (cells that must complete before this one)
    dependencies UUID[] DEFAULT '{}',
    
    -- Execution Configuration
    agent_preference TEXT,  -- 'auto', 'researcher', 'drafter', 'analyst', etc.
    timeout_ms INTEGER DEFAULT 60000,
    retry_on_error BOOLEAN DEFAULT FALSE,
    max_retries INTEGER DEFAULT 2,
    
    -- Execution State
    status TEXT DEFAULT 'idle' CHECK (status IN (
        'idle',         -- Not yet run
        'queued',       -- Waiting for dependencies
        'running',      -- Currently executing
        'paused',       -- Paused by user (approve cells)
        'completed',    -- Successfully finished
        'error',        -- Failed
        'skipped'       -- Skipped due to condition
    )),
    
    -- Execution Results
    output JSONB,                    -- The result data
    output_type TEXT,                -- 'text', 'table', 'chart', 'artifact', 'error'
    artifact_id UUID,                -- Reference to generated artifact
    
    -- Execution Metadata
    agent_used TEXT,                 -- Which agent handled this
    tools_used TEXT[] DEFAULT '{}', -- Which tools were called
    execution_log JSONB DEFAULT '[]', -- Detailed step-by-step log
    reasoning TEXT,                  -- Agent's reasoning (for Glass Cockpit)
    
    -- Usage Tracking
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost NUMERIC(10,6) DEFAULT 0,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(notebook_id, cell_index)
);

-- ============================================
-- NOTEBOOK RUNS TABLE (Execution History)
-- ============================================
CREATE TABLE IF NOT EXISTS notebook_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    
    -- Run info
    run_number INTEGER NOT NULL,
    trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled', 'webhook', 'api')),
    
    -- Status
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    
    -- Cell execution order
    cells_total INTEGER,
    cells_completed INTEGER DEFAULT 0,
    cells_failed INTEGER DEFAULT 0,
    cells_skipped INTEGER DEFAULT 0,
    
    -- Results
    cell_results JSONB DEFAULT '{}',  -- cell_id -> result mapping
    
    -- Usage
    total_tokens INTEGER DEFAULT 0,
    total_cost NUMERIC(10,6) DEFAULT 0,
    duration_ms INTEGER,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Error info
    error_cell_id UUID,
    error_message TEXT
);

-- ============================================
-- NOTEBOOK TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notebook_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template info
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📋',
    category TEXT,  -- 'sales', 'marketing', 'ops', 'finance', etc.
    
    -- Template content (notebook structure without user data)
    cells_template JSONB NOT NULL DEFAULT '[]',
    
    -- Variables that users fill in
    variables JSONB DEFAULT '[]',  -- [{ name: 'company_name', type: 'text', required: true }]
    
    -- Metadata
    author_id TEXT,
    author_name TEXT,
    is_official BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    rating NUMERIC(3,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_project_id ON notebooks(project_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_status ON notebooks(status);
CREATE INDEX IF NOT EXISTS idx_notebook_cells_notebook_id ON notebook_cells(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_cells_status ON notebook_cells(status);
CREATE INDEX IF NOT EXISTS idx_notebook_runs_notebook_id ON notebook_runs(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_templates_category ON notebook_templates(category);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_runs ENABLE ROW LEVEL SECURITY;

-- Notebooks: Users can only see their own or shared notebooks
CREATE POLICY notebooks_user_policy ON notebooks
    FOR ALL USING (
        user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = ANY(shared_with)
        OR is_public = true
    );

-- Cells: Follow notebook access
CREATE POLICY notebook_cells_user_policy ON notebook_cells
    FOR ALL USING (
        user_id = current_setting('app.current_user_id', true)
        OR notebook_id IN (
            SELECT id FROM notebooks 
            WHERE user_id = current_setting('app.current_user_id', true)
               OR current_setting('app.current_user_id', true) = ANY(shared_with)
               OR is_public = true
        )
    );

-- Runs: Follow notebook access
CREATE POLICY notebook_runs_user_policy ON notebook_runs
    FOR ALL USING (
        user_id = current_setting('app.current_user_id', true)
    );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to reorder cells when one is moved/deleted
CREATE OR REPLACE FUNCTION reorder_notebook_cells()
RETURNS TRIGGER AS $$
BEGIN
    -- Reindex all cells in the notebook
    WITH reindexed AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY cell_index) - 1 as new_index
        FROM notebook_cells
        WHERE notebook_id = COALESCE(OLD.notebook_id, NEW.notebook_id)
    )
    UPDATE notebook_cells nc
    SET cell_index = r.new_index
    FROM reindexed r
    WHERE nc.id = r.id AND nc.cell_index != r.new_index;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for cell reordering on delete
CREATE TRIGGER trigger_reorder_cells_on_delete
AFTER DELETE ON notebook_cells
FOR EACH ROW EXECUTE FUNCTION reorder_notebook_cells();

-- Function to update notebook timestamp
CREATE OR REPLACE FUNCTION update_notebook_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE notebooks SET updated_at = NOW() WHERE id = NEW.notebook_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update notebook on cell change
CREATE TRIGGER trigger_update_notebook_timestamp
AFTER INSERT OR UPDATE ON notebook_cells
FOR EACH ROW EXECUTE FUNCTION update_notebook_timestamp();

-- ============================================
-- SEED: Default Templates
-- ============================================
INSERT INTO notebook_templates (name, description, icon, category, cells_template, variables, is_official) VALUES
(
    'Sales Pipeline Analysis',
    'Analyze your CRM data to identify trends and opportunities',
    '📊',
    'sales',
    '[
        {"type": "command", "title": "Fetch Pipeline Data", "content": "Get all deals from {{crm_source}} for the last {{time_period}}"},
        {"type": "transform", "title": "Calculate Metrics", "content": "Calculate win rate, average deal size, and cycle time by stage"},
        {"type": "visualize", "title": "Pipeline Chart", "content": "Create a funnel chart showing deals by stage"},
        {"type": "command", "title": "Identify At-Risk", "content": "Find deals that have been stuck in the same stage for more than {{stale_days}} days"},
        {"type": "note", "title": "Summary", "content": "## Key Findings\n\nAdd your analysis notes here..."}
    ]'::jsonb,
    '[
        {"name": "crm_source", "type": "select", "options": ["HubSpot", "Salesforce", "Pipedrive"], "default": "HubSpot"},
        {"name": "time_period", "type": "select", "options": ["30 days", "90 days", "This quarter", "This year"], "default": "90 days"},
        {"name": "stale_days", "type": "number", "default": 14}
    ]'::jsonb,
    true
),
(
    'Customer Research Brief',
    'Research a company before a sales call or meeting',
    '🔍',
    'sales',
    '[
        {"type": "command", "title": "Company Overview", "content": "Research {{company_name}} and give me a brief overview including industry, size, and recent news"},
        {"type": "command", "title": "Key People", "content": "Find key decision makers at {{company_name}} in {{department}} department"},
        {"type": "query", "title": "Past Interactions", "content": "Search our documents for any previous interactions with {{company_name}}"},
        {"type": "visualize", "title": "Company Profile", "content": "Create a summary document with all the research findings"},
        {"type": "approve", "title": "Review", "content": "Review the research before sharing with the team"}
    ]'::jsonb,
    '[
        {"name": "company_name", "type": "text", "required": true},
        {"name": "department", "type": "text", "default": "sales and marketing"}
    ]'::jsonb,
    true
),
(
    'Weekly Marketing Report',
    'Compile marketing metrics from multiple sources',
    '📈',
    'marketing',
    '[
        {"type": "command", "title": "Email Metrics", "content": "Get email campaign performance from {{email_tool}} for last week"},
        {"type": "command", "title": "Social Metrics", "content": "Get social media engagement metrics for last week"},
        {"type": "command", "title": "Website Traffic", "content": "Get website traffic and conversion data for last week"},
        {"type": "transform", "title": "Combine Data", "content": "Combine all metrics and calculate week-over-week changes"},
        {"type": "visualize", "title": "Dashboard", "content": "Create a marketing dashboard with all key metrics"},
        {"type": "visualize", "title": "Report", "content": "Generate a weekly marketing report document"}
    ]'::jsonb,
    '[
        {"name": "email_tool", "type": "select", "options": ["Mailchimp", "SendGrid", "HubSpot"], "default": "Mailchimp"}
    ]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;
