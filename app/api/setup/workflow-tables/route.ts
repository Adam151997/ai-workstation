// app/api/setup/workflow-tables/route.ts
// Migration endpoint to create workflow persistence tables
// Phase 0: Foundation Solidification

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const maxDuration = 300; // 5 minutes for migrations

export async function GET() {
    try {
        console.log('[Setup] 🚀 Running workflow tables migration...');

        // ========================================
        // 1. Workflow Executions Table
        // ========================================
        console.log('[Setup] Creating workflow_executions table...');
        await query(`
            CREATE TABLE IF NOT EXISTS workflow_executions (
                execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workflow_name VARCHAR(200) NOT NULL,
                workflow_type VARCHAR(20) NOT NULL DEFAULT 'autonomous',
                user_id VARCHAR(100) NOT NULL,
                mode VARCHAR(20) NOT NULL,
                model_id VARCHAR(100) NOT NULL,
                start_time TIMESTAMP NOT NULL DEFAULT NOW(),
                end_time TIMESTAMP,
                status VARCHAR(20) NOT NULL DEFAULT 'running',
                total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                steps_total INTEGER NOT NULL DEFAULT 0,
                steps_completed INTEGER NOT NULL DEFAULT 0,
                steps_failed INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Indexes for workflow_executions
        await query(`CREATE INDEX IF NOT EXISTS idx_workflow_exec_user ON workflow_executions(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_workflow_exec_status ON workflow_executions(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_workflow_exec_mode ON workflow_executions(mode)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_workflow_exec_start_time ON workflow_executions(start_time DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_workflow_exec_user_status ON workflow_executions(user_id, status)`);

        // ========================================
        // 2. Workflow Steps Table
        // ========================================
        console.log('[Setup] Creating workflow_steps table...');
        await query(`
            CREATE TABLE IF NOT EXISTS workflow_steps (
                step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                execution_id UUID NOT NULL REFERENCES workflow_executions(execution_id) ON DELETE CASCADE,
                step_number INTEGER NOT NULL,
                step_name VARCHAR(200) NOT NULL,
                step_description TEXT,
                tool_name VARCHAR(100),
                tool_parameters JSONB,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
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
            )
        `);

        // Indexes for workflow_steps
        await query(`CREATE INDEX IF NOT EXISTS idx_workflow_steps_execution ON workflow_steps(execution_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_workflow_steps_tool ON workflow_steps(tool_name)`);

        // ========================================
        // 3. Audit Logs Table
        // ========================================
        console.log('[Setup] Creating audit_logs table...');
        await query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                execution_id UUID REFERENCES workflow_executions(execution_id) ON DELETE SET NULL,
                step_id UUID REFERENCES workflow_steps(step_id) ON DELETE SET NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
                user_id VARCHAR(100) NOT NULL,
                action_type VARCHAR(30) NOT NULL,
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
            )
        `);

        // Indexes for audit_logs
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_execution ON audit_logs(execution_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC)`);

        // ========================================
        // 4. Observability Metrics Table
        // ========================================
        console.log('[Setup] Creating observability_metrics table...');
        await query(`
            CREATE TABLE IF NOT EXISTS observability_metrics (
                metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
                user_id VARCHAR(100) NOT NULL,
                metric_type VARCHAR(30) NOT NULL,
                metric_value DECIMAL(15, 4) NOT NULL,
                aggregation_period VARCHAR(10) NOT NULL DEFAULT 'hour',
                dimensions JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Indexes for observability_metrics
        await query(`CREATE INDEX IF NOT EXISTS idx_metrics_user ON observability_metrics(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_metrics_type ON observability_metrics(metric_type)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON observability_metrics(timestamp DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_metrics_period ON observability_metrics(aggregation_period)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_metrics_user_type_timestamp ON observability_metrics(user_id, metric_type, timestamp DESC)`);

        // ========================================
        // 5. Billing Records Table
        // ========================================
        console.log('[Setup] Creating billing_records table...');
        await query(`
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
                billing_period VARCHAR(7) NOT NULL,
                paid BOOLEAN NOT NULL DEFAULT false,
                payment_id VARCHAR(100),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Indexes for billing_records
        await query(`CREATE INDEX IF NOT EXISTS idx_billing_user ON billing_records(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_billing_period ON billing_records(billing_period)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_billing_paid ON billing_records(paid)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_billing_user_period ON billing_records(user_id, billing_period)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_billing_timestamp ON billing_records(timestamp DESC)`);

        // ========================================
        // 6. Create update trigger function
        // ========================================
        console.log('[Setup] Creating update trigger function...');
        await query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        // Apply triggers
        await query(`DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON workflow_executions`);
        await query(`
            CREATE TRIGGER update_workflow_executions_updated_at
            BEFORE UPDATE ON workflow_executions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        `);

        await query(`DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps`);
        await query(`
            CREATE TRIGGER update_workflow_steps_updated_at
            BEFORE UPDATE ON workflow_steps
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        `);

        await query(`DROP TRIGGER IF EXISTS update_billing_records_updated_at ON billing_records`);
        await query(`
            CREATE TRIGGER update_billing_records_updated_at
            BEFORE UPDATE ON billing_records
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        `);

        // ========================================
        // 7. Create helper views
        // ========================================
        console.log('[Setup] Creating helper views...');
        
        await query(`
            CREATE OR REPLACE VIEW user_workflow_summary AS
            SELECT 
                user_id,
                COUNT(*) as total_executions,
                COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
                COUNT(*) FILTER (WHERE status = 'running') as running_executions,
                COALESCE(SUM(total_cost), 0) as total_cost,
                COALESCE(SUM(total_tokens), 0) as total_tokens,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE end_time IS NOT NULL) as avg_execution_time_ms,
                MAX(start_time) as last_execution_time
            FROM workflow_executions
            GROUP BY user_id
        `);

        await query(`
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
            ORDER BY date DESC
        `);

        // ========================================
        // 8. Log migration
        // ========================================
        console.log('[Setup] Logging migration...');
        await query(`
            INSERT INTO migrations_log (migration_name) 
            VALUES ('003_workflow_persistence_v1')
            ON CONFLICT DO NOTHING
        `);

        console.log('[Setup] ✅ Workflow tables migration complete!');

        return NextResponse.json({
            success: true,
            message: 'Workflow tables migration completed successfully!',
            tables_created: [
                'workflow_executions',
                'workflow_steps',
                'audit_logs',
                'observability_metrics',
                'billing_records',
            ],
            views_created: [
                'user_workflow_summary',
                'daily_cost_summary',
            ],
            indexes_created: 18,
            triggers_created: 3,
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Migration failed:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message,
                hint: 'Check database connection and permissions',
                details: error.detail || error.code,
            },
            { status: 500 }
        );
    }
}

/**
 * POST endpoint to verify migration status
 */
export async function POST() {
    try {
        console.log('[Setup] Verifying workflow tables...');

        const tables = ['workflow_executions', 'workflow_steps', 'audit_logs', 'observability_metrics', 'billing_records'];
        const results: Record<string, { exists: boolean; rowCount: number }> = {};

        for (const table of tables) {
            try {
                const countResult = await query(`SELECT COUNT(*) as count FROM ${table}`);
                results[table] = {
                    exists: true,
                    rowCount: parseInt(countResult[0].count, 10),
                };
            } catch {
                results[table] = {
                    exists: false,
                    rowCount: 0,
                };
            }
        }

        const allExist = Object.values(results).every(r => r.exists);

        return NextResponse.json({
            success: true,
            migrationComplete: allExist,
            tables: results,
            message: allExist 
                ? 'All workflow tables exist and are ready' 
                : 'Some tables are missing - run GET to create them',
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Verification failed:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message,
            },
            { status: 500 }
        );
    }
}
