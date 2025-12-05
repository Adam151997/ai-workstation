// app/api/setup/workflows/route.ts
// Setup endpoint to run workflow templates migration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Setup] Running workflow templates migration...');

        // Read migration file
        const migrationPath = path.join(process.cwd(), 'migrations', '009_workflow_templates.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

        // Execute migration
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(migrationSQL);
            await client.query('COMMIT');
            console.log('[Setup] ✅ Workflow templates migration completed');
        } catch (error: any) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        // Check what was created
        const tables = await pool.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('workflow_templates', 'workflow_runs', 'workflow_schedules')
        `);

        const templates = await pool.query(`
            SELECT name, category, is_public FROM workflow_templates WHERE user_id = 'system'
        `);

        return NextResponse.json({
            success: true,
            message: 'Workflow templates migration completed',
            tablesCreated: tables.rows.map(r => r.tablename),
            systemTemplates: templates.rows,
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Workflow migration error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to run workflow migration', 
                details: error.message,
                hint: error.hint || null,
            },
            { status: 500 }
        );
    }
}
