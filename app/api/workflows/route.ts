// app/api/workflows/route.ts
// Workflow Templates CRUD API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// GET - List workflow templates
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');
        const includePublic = searchParams.get('includePublic') === 'true';

        let sql = `
            SELECT 
                template_id as id,
                user_id,
                name,
                description,
                category,
                trigger_type,
                steps,
                input_schema,
                variables,
                is_active,
                is_public,
                mode,
                icon,
                color,
                tags,
                run_count,
                last_run_at,
                avg_duration_ms,
                success_rate,
                created_at,
                updated_at
            FROM workflow_templates
            WHERE (user_id = $1 ${includePublic ? "OR is_public = true" : ""})
        `;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (category && category !== 'all') {
            sql += ` AND category = $${paramIndex++}`;
            params.push(category);
        }

        sql += ` ORDER BY updated_at DESC`;

        const templates = await query(sql, params);

        return NextResponse.json({
            success: true,
            templates: templates.map(t => ({
                id: t.id,
                userId: t.user_id,
                name: t.name,
                description: t.description,
                category: t.category,
                triggerType: t.trigger_type,
                steps: t.steps || [],
                inputSchema: t.input_schema || {},
                variables: t.variables || {},
                isActive: t.is_active,
                isPublic: t.is_public,
                mode: t.mode,
                icon: t.icon,
                color: t.color,
                tags: t.tags || [],
                runCount: t.run_count,
                lastRunAt: t.last_run_at,
                avgDurationMs: t.avg_duration_ms,
                successRate: parseFloat(t.success_rate) || 100,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            })),
        });
    } catch (error: any) {
        console.error('[Workflows] List error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch workflows', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create new workflow template
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            name,
            description = '',
            category = 'custom',
            triggerType = 'manual',
            triggerConfig = {},
            steps = [],
            inputSchema = {},
            variables = {},
            mode = 'Sales',
            icon = 'workflow',
            color = '#3B82F6',
            tags = [],
        } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        const result = await query(
            `INSERT INTO workflow_templates (
                user_id, name, description, category, trigger_type, trigger_config,
                steps, input_schema, variables, mode, icon, color, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING template_id as id, created_at`,
            [
                userId,
                name,
                description,
                category,
                triggerType,
                JSON.stringify(triggerConfig),
                JSON.stringify(steps),
                JSON.stringify(inputSchema),
                JSON.stringify(variables),
                mode,
                icon,
                color,
                tags,
            ]
        );

        return NextResponse.json({
            success: true,
            id: result[0].id,
            createdAt: result[0].created_at,
            message: 'Workflow created successfully',
        });
    } catch (error: any) {
        console.error('[Workflows] Create error:', error);
        return NextResponse.json(
            { error: 'Failed to create workflow', details: error.message },
            { status: 500 }
        );
    }
}
