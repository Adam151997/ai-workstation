// app/api/setup/notebooks/route.ts
// Setup API for Business Notebook tables

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        console.log('[Setup] Creating notebook tables...');

        const sql = getInlineMigration();

        // Split by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        let executed = 0;
        const errors: string[] = [];

        for (const statement of statements) {
            try {
                await query(statement + ';', []);
                executed++;
            } catch (err: any) {
                // Ignore "already exists" errors
                if (!err.message?.includes('already exists') && 
                    !err.message?.includes('duplicate key')) {
                    errors.push(`${err.message}: ${statement.substring(0, 100)}...`);
                }
            }
        }

        console.log(`[Setup] ✅ Executed ${executed} statements`);
        if (errors.length > 0) {
            console.log(`[Setup] ⚠️ ${errors.length} errors (may be expected)`);
        }

        // Verify tables exist
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('notebooks', 'notebook_cells', 'notebook_runs', 'notebook_templates')
        `, []);

        return NextResponse.json({
            success: true,
            message: 'Notebook tables created successfully',
            tablesCreated: tables.map((t: any) => t.table_name),
            statementsExecuted: executed,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Error:', error);
        return NextResponse.json(
            { error: 'Failed to create notebook tables', details: error.message },
            { status: 500 }
        );
    }
}

function getInlineMigration(): string {
    return `
        CREATE TABLE IF NOT EXISTS notebooks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT 'Untitled Notebook',
            description TEXT,
            icon TEXT DEFAULT '📓',
            project_id UUID,
            tags TEXT[] DEFAULT '{}',
            is_template BOOLEAN DEFAULT FALSE,
            is_public BOOLEAN DEFAULT FALSE,
            shared_with TEXT[] DEFAULT '{}',
            status TEXT DEFAULT 'idle',
            last_run_at TIMESTAMPTZ,
            last_run_duration_ms INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notebook_cells (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            cell_index INTEGER NOT NULL,
            cell_type TEXT NOT NULL DEFAULT 'command',
            title TEXT,
            content TEXT NOT NULL,
            dependencies UUID[] DEFAULT '{}',
            agent_preference TEXT,
            timeout_ms INTEGER DEFAULT 60000,
            retry_on_error BOOLEAN DEFAULT FALSE,
            max_retries INTEGER DEFAULT 2,
            status TEXT DEFAULT 'idle',
            output JSONB,
            output_type TEXT,
            artifact_id UUID,
            agent_used TEXT,
            tools_used TEXT[] DEFAULT '{}',
            execution_log JSONB DEFAULT '[]',
            reasoning TEXT,
            tokens_input INTEGER DEFAULT 0,
            tokens_output INTEGER DEFAULT 0,
            cost NUMERIC(10,6) DEFAULT 0,
            duration_ms INTEGER,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            error_message TEXT,
            error_details JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(notebook_id, cell_index)
        );

        CREATE TABLE IF NOT EXISTS notebook_runs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            run_number INTEGER NOT NULL,
            trigger_type TEXT DEFAULT 'manual',
            status TEXT DEFAULT 'running',
            cells_total INTEGER,
            cells_completed INTEGER DEFAULT 0,
            cells_failed INTEGER DEFAULT 0,
            cells_skipped INTEGER DEFAULT 0,
            cell_results JSONB DEFAULT '{}',
            total_tokens INTEGER DEFAULT 0,
            total_cost NUMERIC(10,6) DEFAULT 0,
            duration_ms INTEGER,
            started_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            error_cell_id UUID,
            error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS notebook_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT DEFAULT '📋',
            category TEXT,
            cells_template JSONB NOT NULL DEFAULT '[]',
            variables JSONB DEFAULT '[]',
            author_id TEXT,
            author_name TEXT,
            is_official BOOLEAN DEFAULT FALSE,
            is_public BOOLEAN DEFAULT TRUE,
            usage_count INTEGER DEFAULT 0,
            rating NUMERIC(3,2),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON notebooks(user_id);
        CREATE INDEX IF NOT EXISTS idx_notebook_cells_notebook_id ON notebook_cells(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_notebook_runs_notebook_id ON notebook_runs(notebook_id)
    `;
}

export async function GET(req: NextRequest) {
    try {
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('notebooks', 'notebook_cells', 'notebook_runs', 'notebook_templates')
        `, []);

        const counts = await Promise.all([
            query('SELECT COUNT(*) as count FROM notebooks', []).catch(() => [{ count: 0 }]),
            query('SELECT COUNT(*) as count FROM notebook_cells', []).catch(() => [{ count: 0 }]),
            query('SELECT COUNT(*) as count FROM notebook_templates', []).catch(() => [{ count: 0 }]),
        ]);

        return NextResponse.json({
            tablesExist: tables.map((t: any) => t.table_name),
            counts: {
                notebooks: counts[0][0]?.count || 0,
                cells: counts[1][0]?.count || 0,
                templates: counts[2][0]?.count || 0,
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
