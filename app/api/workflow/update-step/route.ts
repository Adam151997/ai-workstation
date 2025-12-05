// app/api/workflow/update-step/route.ts
// Internal endpoint for Trigger.dev to update step status

import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/db/workflow-store';

export async function POST(request: NextRequest) {
    try {
        // Verify internal call
        const isInternal = request.headers.get('x-internal-trigger') === 'true';
        if (!isInternal) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { 
            executionId, 
            stepNumber, 
            status, 
            result, 
            tokensUsed, 
            cost, 
            duration, 
            error 
        } = body;

        if (!executionId || stepNumber === undefined || !status) {
            return NextResponse.json(
                { error: 'Missing required fields: executionId, stepNumber, status' },
                { status: 400 }
            );
        }

        // Get the step to find step_id
        const steps = await workflowStore.getSteps(executionId);
        const step = steps.find(s => s.step_number === stepNumber);

        if (!step) {
            return NextResponse.json(
                { error: `Step ${stepNumber} not found in execution ${executionId}` },
                { status: 404 }
            );
        }

        // Update step
        await workflowStore.updateStep(executionId, step.step_id, {
            status,
            result,
            tokens_used: tokensUsed,
            cost,
            duration_ms: duration,
            error_message: error,
            end_time: status !== 'running' ? new Date().toISOString() : undefined,
        });

        // Also update execution totals if step completed
        if (status === 'success' || status === 'failed') {
            const execution = await workflowStore.getExecution(executionId);
            if (execution) {
                await workflowStore.updateExecution(executionId, {
                    steps_completed: status === 'success' 
                        ? execution.steps_completed + 1 
                        : execution.steps_completed,
                    steps_failed: status === 'failed'
                        ? execution.steps_failed + 1
                        : execution.steps_failed,
                    total_tokens: execution.total_tokens + (tokensUsed || 0),
                    total_cost: execution.total_cost + (cost || 0),
                });
            }
        }

        console.log(`[Update Step] ✅ Step ${stepNumber} → ${status}`);

        return NextResponse.json({
            success: true,
            stepId: step.step_id,
            status,
        });

    } catch (error: any) {
        console.error('[Update Step] ❌ Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
