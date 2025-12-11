// app/api/workflows/[id]/run/route.ts
// Execute a workflow

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { logWorkflowAction } from '@/lib/audit';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: workflowId } = await params;
        const body = await req.json().catch(() => ({}));
        const { variables = {} } = body;

        // Fetch workflow template
        const templates = await query(
            `SELECT * FROM workflow_templates WHERE template_id = $1 AND (user_id = $2 OR is_public = true)`,
            [workflowId, userId]
        );

        if (templates.length === 0) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        const template = templates[0];

        if (!template.is_active) {
            return NextResponse.json({ error: 'Workflow is not active' }, { status: 400 });
        }

        const steps = template.steps || [];
        if (steps.length === 0) {
            return NextResponse.json({ error: 'Workflow has no steps' }, { status: 400 });
        }

        // Create execution record
        const executionId = uuidv4();
        await query(
            `INSERT INTO workflow_executions (
                execution_id, workflow_name, workflow_type, user_id, mode, model_id,
                start_time, status, total_cost, total_tokens, steps_total, steps_completed, steps_failed,
                metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'running', 0, 0, $7, 0, 0, $8)`,
            [
                executionId,
                template.name,
                'template',
                userId,
                template.mode,
                'gpt-4',
                steps.length,
                JSON.stringify({
                    templateId: workflowId,
                    triggerType: template.trigger_type,
                    variables,
                }),
            ]
        );

        // Create step records
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            await query(
                `INSERT INTO workflow_steps (
                    step_id, execution_id, step_number, step_name, step_description,
                    tool_name, tool_parameters, status, tokens_used, cost, retry_count
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, 0, 0)`,
                [
                    step.id || uuidv4(),
                    executionId,
                    i + 1,
                    step.name,
                    step.description || `${step.type} step`,
                    step.type,
                    JSON.stringify(step.config || {}),
                ]
            );
        }

        // Update run count on template
        await query(
            `UPDATE workflow_templates 
             SET run_count = run_count + 1, last_run_at = NOW() 
             WHERE template_id = $1`,
            [workflowId]
        );

        // Log audit
        await logWorkflowAction(userId, 'workflow.execute', executionId, {
            templateId: workflowId,
            templateName: template.name,
            stepsCount: steps.length,
        });

        // TODO: Trigger actual workflow execution via Trigger.dev
        // For now, we just create the records

        return NextResponse.json({
            success: true,
            executionId,
            message: 'Workflow execution started',
            stepsTotal: steps.length,
        });
    } catch (error: any) {
        console.error('[Workflow Run] Error:', error);
        return NextResponse.json(
            { error: 'Failed to run workflow', details: error.message },
            { status: 500 }
        );
    }
}
