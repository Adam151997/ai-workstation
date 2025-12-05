-- Migration: ETL Pipeline Infrastructure
-- Phase 4: Bulk data ingestion from external sources
-- Run via: http://localhost:3000/api/setup/etl-pipelines

-- ============================================
-- 1. Data Sources Table
-- ============================================
-- Tracks connected external data sources

CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'google_drive', 'gmail', 'notion', 'slack', 'dropbox', 'onedrive'
    connection_status VARCHAR(20) DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error', 'syncing'
    auth_data JSONB, -- Encrypted tokens, credentials (encrypt in application layer)
    config JSONB DEFAULT '{}', -- Source-specific configuration
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(20), -- 'success', 'partial', 'failed'
    last_sync_error TEXT,
    total_items_synced INTEGER DEFAULT 0,
    sync_frequency VARCHAR(20) DEFAULT 'manual', -- 'manual', 'hourly', 'daily', 'weekly'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_sources_user ON data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_data_sources_active ON data_sources(user_id, is_active);

-- ============================================
-- 2. Sync Jobs Table
-- ============================================
-- Tracks individual sync operations

CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    job_type VARCHAR(30) NOT NULL, -- 'full_sync', 'incremental', 'delta', 'manual'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    items_found INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    bytes_processed BIGINT DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    progress_data JSONB DEFAULT '{}', -- For resumable syncs
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_jobs_user ON sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_source ON sync_jobs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON sync_jobs(created_at DESC);

-- ============================================
-- 3. Sync Items Table
-- ============================================
-- Tracks individual items being synced (for deduplication and delta sync)

CREATE TABLE IF NOT EXISTS sync_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    external_id VARCHAR(500) NOT NULL, -- ID in the external system
    external_path TEXT, -- Path/URL in external system
    item_type VARCHAR(50), -- 'file', 'email', 'message', 'page', 'note'
    item_name VARCHAR(500),
    mime_type VARCHAR(100),
    file_size BIGINT,
    external_modified_at TIMESTAMP,
    external_hash VARCHAR(100), -- For detecting changes
    local_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    sync_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'synced', 'failed', 'skipped'
    last_synced_at TIMESTAMP,
    sync_error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(data_source_id, external_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_items_user ON sync_items(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_items_source ON sync_items(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_items_external ON sync_items(data_source_id, external_id);
CREATE INDEX IF NOT EXISTS idx_sync_items_status ON sync_items(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_items_document ON sync_items(local_document_id);

-- ============================================
-- 4. ETL Transformations Table
-- ============================================
-- Defines data transformations/mappings

CREATE TABLE IF NOT EXISTS etl_transformations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    source_type VARCHAR(50) NOT NULL, -- Which data source type this applies to
    transformation_type VARCHAR(50), -- 'field_mapping', 'filter', 'enrich', 'split', 'merge'
    config JSONB NOT NULL, -- Transformation configuration
    is_active BOOLEAN DEFAULT true,
    execution_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etl_transformations_user ON etl_transformations(user_id);
CREATE INDEX IF NOT EXISTS idx_etl_transformations_source ON etl_transformations(source_type);

-- ============================================
-- 5. Scheduled Syncs Table
-- ============================================
-- For automated sync scheduling

CREATE TABLE IF NOT EXISTS scheduled_syncs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL, -- 'cron', 'interval', 'daily', 'weekly'
    schedule_config JSONB NOT NULL, -- e.g., {"cron": "0 */6 * * *"} or {"interval_hours": 6}
    next_run_at TIMESTAMP,
    last_run_at TIMESTAMP,
    last_run_status VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_syncs_next ON scheduled_syncs(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_syncs_source ON scheduled_syncs(data_source_id);

-- ============================================
-- 6. RLS Policies for ETL Tables
-- ============================================

ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_transformations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_syncs ENABLE ROW LEVEL SECURITY;

-- Data sources policy
DROP POLICY IF EXISTS data_sources_isolation ON data_sources;
CREATE POLICY data_sources_isolation ON data_sources
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Sync jobs policy
DROP POLICY IF EXISTS sync_jobs_isolation ON sync_jobs;
CREATE POLICY sync_jobs_isolation ON sync_jobs
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Sync items policy
DROP POLICY IF EXISTS sync_items_isolation ON sync_items;
CREATE POLICY sync_items_isolation ON sync_items
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ETL transformations policy
DROP POLICY IF EXISTS etl_transformations_isolation ON etl_transformations;
CREATE POLICY etl_transformations_isolation ON etl_transformations
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Scheduled syncs policy
DROP POLICY IF EXISTS scheduled_syncs_isolation ON scheduled_syncs;
CREATE POLICY scheduled_syncs_isolation ON scheduled_syncs
    FOR ALL
    USING (user_id = current_setting('app.current_user_id', true))
    WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- 7. Update triggers
-- ============================================

DROP TRIGGER IF EXISTS trigger_data_sources_updated ON data_sources;
CREATE TRIGGER trigger_data_sources_updated
    BEFORE UPDATE ON data_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_sync_items_updated ON sync_items;
CREATE TRIGGER trigger_sync_items_updated
    BEFORE UPDATE ON sync_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_etl_transformations_updated ON etl_transformations;
CREATE TRIGGER trigger_etl_transformations_updated
    BEFORE UPDATE ON etl_transformations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_scheduled_syncs_updated ON scheduled_syncs;
CREATE TRIGGER trigger_scheduled_syncs_updated
    BEFORE UPDATE ON scheduled_syncs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Helper Views
-- ============================================

-- Data source summary view
CREATE OR REPLACE VIEW data_source_summary AS
SELECT 
    ds.id,
    ds.user_id,
    ds.name,
    ds.source_type,
    ds.connection_status,
    ds.last_sync_at,
    ds.last_sync_status,
    ds.total_items_synced,
    ds.sync_frequency,
    ds.is_active,
    (SELECT COUNT(*) FROM sync_items si WHERE si.data_source_id = ds.id) as item_count,
    (SELECT COUNT(*) FROM sync_jobs sj WHERE sj.data_source_id = ds.id AND sj.status = 'running') as running_jobs
FROM data_sources ds;

-- Sync job summary view
CREATE OR REPLACE VIEW sync_job_summary AS
SELECT 
    sj.*,
    ds.name as source_name,
    ds.source_type,
    CASE 
        WHEN sj.completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (sj.completed_at - sj.started_at))
        ELSE NULL 
    END as duration_seconds
FROM sync_jobs sj
JOIN data_sources ds ON sj.data_source_id = ds.id;

-- ============================================
-- 9. Migration log
-- ============================================

INSERT INTO migrations_log (migration_name) 
VALUES ('006_etl_pipelines_v1')
ON CONFLICT DO NOTHING;
