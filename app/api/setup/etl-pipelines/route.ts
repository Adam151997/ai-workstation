// app/api/setup/etl-pipelines/route.ts
// Migration endpoint for ETL Pipeline infrastructure
// Phase 4: Bulk data ingestion from external sources

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const maxDuration = 300;

export async function GET() {
    try {
        console.log('[Setup] 🚀 Running ETL Pipelines migration...');

        // ========================================
        // 1. Data Sources Table
        // ========================================
        console.log('[Setup] Creating data_sources table...');
        await query(`
            CREATE TABLE IF NOT EXISTS data_sources (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(100) NOT NULL,
                name VARCHAR(200) NOT NULL,
                source_type VARCHAR(50) NOT NULL,
                connection_status VARCHAR(20) DEFAULT 'disconnected',
                auth_data JSONB,
                config JSONB DEFAULT '{}',
                last_sync_at TIMESTAMP,
                last_sync_status VARCHAR(20),
                last_sync_error TEXT,
                total_items_synced INTEGER DEFAULT 0,
                sync_frequency VARCHAR(20) DEFAULT 'manual',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_data_sources_user ON data_sources(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(user_id, source_type)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_data_sources_active ON data_sources(user_id, is_active)`);

        // ========================================
        // 2. Sync Jobs Table
        // ========================================
        console.log('[Setup] Creating sync_jobs table...');
        await query(`
            CREATE TABLE IF NOT EXISTS sync_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(100) NOT NULL,
                data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
                job_type VARCHAR(30) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
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
                progress_data JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_sync_jobs_user ON sync_jobs(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_sync_jobs_source ON sync_jobs(data_source_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON sync_jobs(created_at DESC)`);

        // ========================================
        // 3. Sync Items Table
        // ========================================
        console.log('[Setup] Creating sync_items table...');
        await query(`
            CREATE TABLE IF NOT EXISTS sync_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(100) NOT NULL,
                data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
                external_id VARCHAR(500) NOT NULL,
                external_path TEXT,
                item_type VARCHAR(50),
                item_name VARCHAR(500),
                mime_type VARCHAR(100),
                file_size BIGINT,
                external_modified_at TIMESTAMP,
                external_hash VARCHAR(100),
                local_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
                sync_status VARCHAR(20) DEFAULT 'pending',
                last_synced_at TIMESTAMP,
                sync_error TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(data_source_id, external_id)
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_sync_items_user ON sync_items(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_sync_items_source ON sync_items(data_source_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_sync_items_external ON sync_items(data_source_id, external_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_sync_items_status ON sync_items(sync_status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_sync_items_document ON sync_items(local_document_id)`);

        // ========================================
        // 4. ETL Transformations Table
        // ========================================
        console.log('[Setup] Creating etl_transformations table...');
        await query(`
            CREATE TABLE IF NOT EXISTS etl_transformations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(100) NOT NULL,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                source_type VARCHAR(50) NOT NULL,
                transformation_type VARCHAR(50),
                config JSONB NOT NULL,
                is_active BOOLEAN DEFAULT true,
                execution_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_etl_transformations_user ON etl_transformations(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_etl_transformations_source ON etl_transformations(source_type)`);

        // ========================================
        // 5. Scheduled Syncs Table
        // ========================================
        console.log('[Setup] Creating scheduled_syncs table...');
        await query(`
            CREATE TABLE IF NOT EXISTS scheduled_syncs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(100) NOT NULL,
                data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
                schedule_type VARCHAR(20) NOT NULL,
                schedule_config JSONB NOT NULL,
                next_run_at TIMESTAMP,
                last_run_at TIMESTAMP,
                last_run_status VARCHAR(20),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_scheduled_syncs_next ON scheduled_syncs(next_run_at) WHERE is_active = true`);
        await query(`CREATE INDEX IF NOT EXISTS idx_scheduled_syncs_source ON scheduled_syncs(data_source_id)`);

        // ========================================
        // 6. Enable RLS
        // ========================================
        console.log('[Setup] Enabling RLS on ETL tables...');
        
        const etlTables = ['data_sources', 'sync_jobs', 'sync_items', 'etl_transformations', 'scheduled_syncs'];
        for (const table of etlTables) {
            await query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        }

        // ========================================
        // 7. Create RLS Policies
        // ========================================
        console.log('[Setup] Creating RLS policies...');

        await query(`DROP POLICY IF EXISTS data_sources_isolation ON data_sources`);
        await query(`
            CREATE POLICY data_sources_isolation ON data_sources
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        await query(`DROP POLICY IF EXISTS sync_jobs_isolation ON sync_jobs`);
        await query(`
            CREATE POLICY sync_jobs_isolation ON sync_jobs
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        await query(`DROP POLICY IF EXISTS sync_items_isolation ON sync_items`);
        await query(`
            CREATE POLICY sync_items_isolation ON sync_items
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        await query(`DROP POLICY IF EXISTS etl_transformations_isolation ON etl_transformations`);
        await query(`
            CREATE POLICY etl_transformations_isolation ON etl_transformations
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        await query(`DROP POLICY IF EXISTS scheduled_syncs_isolation ON scheduled_syncs`);
        await query(`
            CREATE POLICY scheduled_syncs_isolation ON scheduled_syncs
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        // ========================================
        // 8. Create Update Triggers
        // ========================================
        console.log('[Setup] Creating update triggers...');

        const triggeredTables = ['data_sources', 'sync_items', 'etl_transformations', 'scheduled_syncs'];
        for (const table of triggeredTables) {
            await query(`DROP TRIGGER IF EXISTS trigger_${table}_updated ON ${table}`);
            await query(`
                CREATE TRIGGER trigger_${table}_updated
                BEFORE UPDATE ON ${table}
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
            `);
        }

        // ========================================
        // 9. Create Helper Views
        // ========================================
        console.log('[Setup] Creating helper views...');

        await query(`
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
            FROM data_sources ds
        `);

        await query(`
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
            JOIN data_sources ds ON sj.data_source_id = ds.id
        `);

        // ========================================
        // 10. Log migration
        // ========================================
        console.log('[Setup] Logging migration...');
        await query(`
            INSERT INTO migrations_log (migration_name) 
            VALUES ('006_etl_pipelines_v1')
            ON CONFLICT DO NOTHING
        `);

        console.log('[Setup] ✅ ETL Pipelines migration complete!');

        return NextResponse.json({
            success: true,
            message: 'ETL Pipelines migration completed successfully!',
            tables_created: [
                'data_sources',
                'sync_jobs', 
                'sync_items',
                'etl_transformations',
                'scheduled_syncs',
            ],
            views_created: [
                'data_source_summary',
                'sync_job_summary',
            ],
            rls_policies_created: [
                'data_sources_isolation',
                'sync_jobs_isolation',
                'sync_items_isolation',
                'etl_transformations_isolation',
                'scheduled_syncs_isolation',
            ],
            supported_sources: [
                'google_drive',
                'gmail',
                'notion',
                'slack',
                'dropbox',
                'onedrive',
            ],
        });

    } catch (error: any) {
        console.error('[Setup] ❌ ETL migration failed:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message,
                hint: 'Check if prerequisite tables exist',
                details: error.detail || error.code,
            },
            { status: 500 }
        );
    }
}

export async function POST() {
    try {
        console.log('[Setup] Verifying ETL tables...');

        const tables = ['data_sources', 'sync_jobs', 'sync_items', 'etl_transformations', 'scheduled_syncs'];
        const results: Record<string, { exists: boolean; rowCount: number; rlsEnabled: boolean }> = {};

        for (const table of tables) {
            try {
                const countResult = await query(`SELECT COUNT(*) as count FROM ${table}`);
                const rlsResult = await query(`
                    SELECT rowsecurity FROM pg_tables 
                    WHERE schemaname = 'public' AND tablename = $1
                `, [table]);
                
                results[table] = {
                    exists: true,
                    rowCount: parseInt(countResult[0].count, 10),
                    rlsEnabled: rlsResult[0]?.rowsecurity || false,
                };
            } catch {
                results[table] = {
                    exists: false,
                    rowCount: 0,
                    rlsEnabled: false,
                };
            }
        }

        const allExist = Object.values(results).every(r => r.exists);

        return NextResponse.json({
            success: true,
            migrationComplete: allExist,
            tables: results,
            message: allExist 
                ? 'All ETL tables exist and are ready' 
                : 'Some tables are missing - run GET to create them',
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Verification failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
