// app/api/setup/row-level-security/route.ts
// Migration endpoint for Row-Level Security policies
// Phase 3: Enterprise-grade data isolation

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const maxDuration = 300;

export async function GET() {
    try {
        console.log('[Setup] 🚀 Running Row-Level Security migration...');

        // ========================================
        // 1. Enable RLS on all tables
        // ========================================
        console.log('[Setup] Enabling RLS on tables...');
        
        const tables = [
            'documents',
            'document_chunks', 
            'projects',
            'tags',
            'document_tags',
            'workflow_executions',
            'workflow_steps',
            'audit_logs',
            'observability_metrics',
            'billing_records',
        ];

        for (const table of tables) {
            try {
                await query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
                console.log(`[Setup] ✅ RLS enabled on ${table}`);
            } catch (err: any) {
                // Table might not exist yet, that's ok
                console.log(`[Setup] ⚠️ Could not enable RLS on ${table}: ${err.message}`);
            }
        }

        // ========================================
        // 2. Create app_user role
        // ========================================
        console.log('[Setup] Creating app_user role...');
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
                    CREATE ROLE app_user NOLOGIN;
                END IF;
            END
            $$
        `);

        // ========================================
        // 3. Create RLS policies
        // ========================================
        console.log('[Setup] Creating RLS policies...');

        // Documents policy
        await query(`DROP POLICY IF EXISTS documents_isolation ON documents`);
        await query(`
            CREATE POLICY documents_isolation ON documents
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        // Document chunks policy (inherits from document)
        await query(`DROP POLICY IF EXISTS document_chunks_isolation ON document_chunks`);
        await query(`
            CREATE POLICY document_chunks_isolation ON document_chunks
            FOR ALL
            USING (
                document_id IN (
                    SELECT id FROM documents 
                    WHERE user_id = current_setting('app.current_user_id', true)
                )
            )
        `);

        // Projects policy
        await query(`DROP POLICY IF EXISTS projects_isolation ON projects`);
        await query(`
            CREATE POLICY projects_isolation ON projects
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        // Tags policy
        await query(`DROP POLICY IF EXISTS tags_isolation ON tags`);
        await query(`
            CREATE POLICY tags_isolation ON tags
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        // Document tags policy
        await query(`DROP POLICY IF EXISTS document_tags_isolation ON document_tags`);
        await query(`
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
            )
        `);

        // Workflow executions policy
        await query(`DROP POLICY IF EXISTS workflow_executions_isolation ON workflow_executions`);
        await query(`
            CREATE POLICY workflow_executions_isolation ON workflow_executions
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        // Workflow steps policy (inherits from execution)
        await query(`DROP POLICY IF EXISTS workflow_steps_isolation ON workflow_steps`);
        await query(`
            CREATE POLICY workflow_steps_isolation ON workflow_steps
            FOR ALL
            USING (
                execution_id IN (
                    SELECT execution_id FROM workflow_executions 
                    WHERE user_id = current_setting('app.current_user_id', true)
                )
            )
        `);

        // Audit logs policy
        await query(`DROP POLICY IF EXISTS audit_logs_isolation ON audit_logs`);
        await query(`
            CREATE POLICY audit_logs_isolation ON audit_logs
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        // Observability metrics policy
        await query(`DROP POLICY IF EXISTS observability_metrics_isolation ON observability_metrics`);
        await query(`
            CREATE POLICY observability_metrics_isolation ON observability_metrics
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        // Billing records policy
        await query(`DROP POLICY IF EXISTS billing_records_isolation ON billing_records`);
        await query(`
            CREATE POLICY billing_records_isolation ON billing_records
            FOR ALL
            USING (user_id = current_setting('app.current_user_id', true))
            WITH CHECK (user_id = current_setting('app.current_user_id', true))
        `);

        // ========================================
        // 4. Create helper functions
        // ========================================
        console.log('[Setup] Creating helper functions...');

        await query(`
            CREATE OR REPLACE FUNCTION set_current_user_id(p_user_id TEXT)
            RETURNS VOID AS $$
            BEGIN
                PERFORM set_config('app.current_user_id', p_user_id, false);
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER
        `);

        await query(`
            CREATE OR REPLACE FUNCTION get_current_user_id()
            RETURNS TEXT AS $$
            BEGIN
                RETURN current_setting('app.current_user_id', true);
            END;
            $$ LANGUAGE plpgsql
        `);

        // ========================================
        // 5. Create verification view
        // ========================================
        console.log('[Setup] Creating verification view...');
        
        await query(`
            CREATE OR REPLACE VIEW rls_status AS
            SELECT 
                schemaname,
                tablename,
                rowsecurity as rls_enabled
            FROM pg_tables t
            WHERE schemaname = 'public'
            AND tablename IN (
                'documents', 'document_chunks', 'projects', 'tags', 'document_tags',
                'workflow_executions', 'workflow_steps', 'audit_logs', 
                'observability_metrics', 'billing_records'
            )
        `);

        // ========================================
        // 6. Log migration
        // ========================================
        console.log('[Setup] Logging migration...');
        await query(`
            INSERT INTO migrations_log (migration_name) 
            VALUES ('005_row_level_security_v1')
            ON CONFLICT DO NOTHING
        `);

        console.log('[Setup] ✅ Row-Level Security migration complete!');

        return NextResponse.json({
            success: true,
            message: 'Row-Level Security migration completed successfully!',
            tables_secured: tables,
            policies_created: [
                'documents_isolation',
                'document_chunks_isolation',
                'projects_isolation',
                'tags_isolation',
                'document_tags_isolation',
                'workflow_executions_isolation',
                'workflow_steps_isolation',
                'audit_logs_isolation',
                'observability_metrics_isolation',
                'billing_records_isolation',
            ],
            functions_created: [
                'set_current_user_id',
                'get_current_user_id',
            ],
            note: 'RLS is enabled but requires calling set_current_user_id() before queries to activate filtering',
        });

    } catch (error: any) {
        console.error('[Setup] ❌ RLS migration failed:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message,
                hint: 'Check database permissions',
                details: error.detail || error.code,
            },
            { status: 500 }
        );
    }
}

export async function POST() {
    try {
        console.log('[Setup] Verifying RLS status...');

        // Check RLS status for all tables
        const status = await query(`
            SELECT 
                tablename,
                rowsecurity as rls_enabled
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename IN (
                'documents', 'document_chunks', 'projects', 'tags', 'document_tags',
                'workflow_executions', 'workflow_steps', 'audit_logs', 
                'observability_metrics', 'billing_records'
            )
        `);

        // Check policies
        const policies = await query(`
            SELECT tablename, policyname
            FROM pg_policies
            WHERE schemaname = 'public'
        `);

        const tablesWithRLS = status.filter((t: any) => t.rls_enabled);
        const allSecured = tablesWithRLS.length === status.length;

        return NextResponse.json({
            success: true,
            allTablesSecured: allSecured,
            tableStatus: status.map((t: any) => ({
                table: t.tablename,
                rlsEnabled: t.rls_enabled,
            })),
            policies: policies.map((p: any) => ({
                table: p.tablename,
                policy: p.policyname,
            })),
            message: allSecured 
                ? 'All tables have RLS enabled' 
                : 'Some tables are missing RLS - run GET to apply',
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Verification failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
