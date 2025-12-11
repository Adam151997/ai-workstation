// app/api/workflows/[id]/route.ts
// Single Workflow Template API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// GET - Get single workflow
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const results = await query(
            `SELECT 
                template_id as id,
                user_id,
                name,
                description,
                category,
                trigger_type,
                trigger_config,
                steps,
                input_schema,
                variables,
                is_active,
                is_public,
                mode,
                max_steps,
                timeout_seconds,
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
            WHERE template_id = $1 AND (user_id = $2 OR is_public = true)`,
            [id, userId]
        );

        if (results.length === 0) {
            return NextResponse.json(
                { error: 'Workflow not found' },
                { status: 404 }
            );
        }

        const t = results[0];

        return NextResponse.json({
            success: true,
            template: {
                id: t.id,
                userId: t.user_id,
                name: t.name,
                description: t.description,
                category: t.category,
                triggerType: t.trigger_type,
                triggerConfig: t.trigger_config || {},
                steps: t.steps || [],
                inputSchema: t.input_schema || {},
                variables: t.variables || {},
                isActive: t.is_active,
                isPublic: t.is_public,
                mode: t.mode,
                maxSteps: t.max_steps,
                timeoutSeconds: t.timeout_seconds,
                icon: t.icon,
                color: t.color,
                tags: t.tags || [],
                runCount: t.run_count,
                lastRunAt: t.last_run_at,
                avgDurationMs: t.avg_duration_ms,
                successRate: parseFloat(t.success_rate) || 100,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            },
        });
    } catch (error: any) {
        console.error('[Workflows] Get error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch workflow', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update workflow
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();

        // Verify ownership
        const existing = await query(
            `SELECT user_id FROM workflow_templates WHERE template_id = $1`,
            [id]
        );

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        if (existing[0].user_id !== userId && existing[0].user_id !== 'system') {
            return NextResponse.json({ error: 'Not authorized to edit this workflow' }, { status: 403 });
        }

        // Build update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        const allowedFields = [
            'name', 'description', 'category', 'trigger_type', 'trigger_config',
            'steps', 'input_schema', 'variables', 'is_active', 'is_public',
            'mode', 'max_steps', 'timeout_seconds', 'icon', 'color', 'tags'
        ];

        const fieldMapping: Record<string, string> = {
            triggerType: 'trigger_type',
            triggerConfig: 'trigger_config',
            inputSchema: 'input_schema',
            isActive: 'is_active',
            isPublic: 'is_public',
            maxSteps: 'max_steps',
            timeoutSeconds: 'timeout_seconds',
        };

        for (const [key, value] of Object.entries(body)) {
            const dbField = fieldMapping[key] || key;
            if (allowedFields.includes(dbField) && value !== undefined) {
                updates.push(`${dbField} = $${paramIndex++}`);
                // JSON fields
                if (['trigger_config', 'steps', 'input_schema', 'variables'].includes(dbField)) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await query(
            `UPDATE workflow_templates SET ${updates.join(', ')} WHERE template_id = $${paramIndex}`,
            values
        );

        return NextResponse.json({
            success: true,
            message: 'Workflow updated successfully',
        });
    } catch (error: any) {
        console.error('[Workflows] Update error:', error);
        return NextResponse.json(
            { error: 'Failed to update workflow', details: error.message },
            { status: 500 }
        );
    }
}

// PATCH - Partial update workflow
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Reuse PUT logic for partial updates
    return PUT(req, { params });
}

// DELETE - Delete workflow
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Verify ownership
        const existing = await query(
            `SELECT user_id FROM workflow_templates WHERE template_id = $1`,
            [id]
        );

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        if (existing[0].user_id !== userId) {
            return NextResponse.json({ error: 'Not authorized to delete this workflow' }, { status: 403 });
        }

        await query(
            `DELETE FROM workflow_templates WHERE template_id = $1`,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: 'Workflow deleted successfully',
        });
    } catch (error: any) {
        console.error('[Workflows] Delete error:', error);
        return NextResponse.json(
            { error: 'Failed to delete workflow', details: error.message },
            { status: 500 }
        );
    }
}
