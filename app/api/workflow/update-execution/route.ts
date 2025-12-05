// app/api/workflow/update-execution/route.ts
// Internal endpoint for Trigger.dev to update execution status

import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/db/workflow-store';
import { v4 as uuidv4 } from 'uuid';

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
            status, 
            totalTokens, 
            totalCost, 
            stepsCompleted, 
            stepsFailed,
            errorMessage 
        } = body;

        if (!executionId || !status) {
            return NextResponse.json(
                { error: 'Missing required fields: executionId, status' },
                { status: 400 }
            );
        }

        // Get execution to verify it exists
        const execution = await workflowStore.getExecution(executionId);
        if (!execution) {
            return NextResponse.json(
                { error: `Execution ${executionId} not found` },
                { status: 404 }
            );
        }

        // Update execution
        await workflowStore.updateExecution(executionId, {
            status,
            end_time: new Date().toISOString(),
            total_tokens: totalTokens ?? execution.total_tokens,
            total_cost: totalCost ?? execution.total_cost,
            steps_completed: stepsCompleted ?? execution.steps_completed,
            steps_failed: stepsFailed ?? execution.steps_failed,
            error_message: errorMessage,
        });

        // Create billing record if workflow completed
        if (['success', 'failed', 'partial'].includes(status)) {
            const now = new Date();
            const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            await workflowStore.addBillingRecord({
                billing_id: uuidv4(),
                user_id: execution.user_id,
                execution_id: executionId,
                timestamp: now.toISOString(),
                model_id: execution.model_id,
                tokens_input: Math.floor((totalTokens || execution.total_tokens) * 0.6),
                tokens_output: Math.floor((totalTokens || execution.total_tokens) * 0.4),
                tokens_total: totalTokens || execution.total_tokens,
                cost: totalCost || execution.total_cost,
                billing_period: billingPeriod,
                paid: false,
            });
        }

        // Add audit log
        await workflowStore.addAuditLog(executionId, {
            log_id: uuidv4(),
            execution_id: executionId,
            timestamp: new Date().toISOString(),
            user_id: execution.user_id,
            action_type: 'workflow_end',
            action_details: `Workflow ${status}: ${execution.workflow_name}`,
            tokens_used: totalTokens || 0,
            cost: totalCost || 0,
            model_id: execution.model_id,
            success: status === 'success',
            error_message: errorMessage,
            metadata: {
                stepsCompleted,
                stepsFailed,
                source: 'trigger.dev',
            },
        });

        console.log(`[Update Execution] ✅ ${executionId} → ${status}`);

        return NextResponse.json({
            success: true,
            executionId,
            status,
        });

    } catch (error: any) {
        console.error('[Update Execution] ❌ Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
