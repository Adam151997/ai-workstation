// app/api/setup/toolkits/route.ts
// Setup endpoint to create toolkit marketplace tables

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        // Read and execute the migration file
        const migrationPath = path.join(process.cwd(), 'migrations', '008_toolkits.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

        // Split by semicolons and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        const results = [];
        for (const statement of statements) {
            try {
                await query(statement);
                results.push({ success: true });
            } catch (err: any) {
                // Continue on non-critical errors (like "already exists")
                if (!err.message.includes('already exists') && !err.message.includes('duplicate key')) {
                    console.error('Statement failed:', err.message);
                }
                results.push({ success: false, error: err.message });
            }
        }

        // Verify tables exist
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('toolkit_catalog', 'user_toolkits', 'toolkit_categories')
        `);

        // Count seeded toolkits
        const toolkitCount = await query('SELECT COUNT(*) as count FROM toolkit_catalog');

        return NextResponse.json({
            success: true,
            message: 'Toolkit tables created successfully',
            tablesCreated: tables.map((t: any) => t.table_name),
            toolkitsSeeded: parseInt(toolkitCount[0].count),
            statementsExecuted: results.filter(r => r.success).length,
        });

    } catch (error: any) {
        console.error('[Setup Toolkits] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create toolkit tables', details: error.message },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        // Check if tables exist
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('toolkit_catalog', 'user_toolkits', 'toolkit_categories')
        `);

        const toolkitCount = await query('SELECT COUNT(*) as count FROM toolkit_catalog').catch(() => [{ count: 0 }]);
        const categoryCount = await query('SELECT COUNT(*) as count FROM toolkit_categories').catch(() => [{ count: 0 }]);

        return NextResponse.json({
            tablesExist: tables.map((t: any) => t.table_name),
            toolkitsSeeded: parseInt(toolkitCount[0]?.count || 0),
            categoriesSeeded: parseInt(categoryCount[0]?.count || 0),
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to check tables', details: error.message },
            { status: 500 }
        );
    }
}
