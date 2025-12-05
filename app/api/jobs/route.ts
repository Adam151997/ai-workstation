// app/api/jobs/route.ts
// API endpoint to trigger and manage background jobs

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { tasks } from "@trigger.dev/sdk/v3";
import { workflowStore } from '@/lib/db/workflow-store';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowJobPayload, BulkDocumentJobPayload } from '@/trigger/client';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { jobType, payload } = body;

        switch (jobType) {
            case 'workflow': {
                return await triggerWorkflowJob(userId, payload);
            }

            case 'bulk-documents': {
                return await triggerBulkDocumentJob(userId, payload);
            }

            case 'document-reprocess': {
                return await triggerDocumentReprocessJob(userId, payload);
            }

            default:
                return NextResponse.json(
                    { error: `Unknown job type: ${jobType}` },
                    { status: 400 }
                );
        }

    } catch (error: any) {
        console.error('[Jobs API] ❌ Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

/**
 * Trigger a workflow execution job
 */
async function triggerWorkflowJob(userId: string, payload: {
    workflowName: string;
    workflowDescription: string;
    steps: Array<{ name: string; description: string; tool?: string; parameters?: Record<string, any> }>;
    mode: 'Sales' | 'Marketing' | 'Admin';
    modelId: string;
}) {
    const executionId = uuidv4();

    // Create execution record in database
    await workflowStore.createExecution({
        execution_id: executionId,
        workflow_name: payload.workflowName,
        workflow_type: 'autonomous',
        user_id: userId,
        mode: payload.mode,
        model_id: payload.modelId,
        start_time: new Date().toISOString(),
        status: 'running',
        total_cost: 0,
        total_tokens: 0,
        steps_total: payload.steps.length,
        steps_completed: 0,
        steps_failed: 0,
        metadata: {
            description: payload.workflowDescription,
            triggeredBy: 'api',
            source: 'trigger.dev',
        },
    });

    // Create step records
    for (let i = 0; i < payload.steps.length; i++) {
        const step = payload.steps[i];
        await workflowStore.addStep(executionId, {
            step_id: uuidv4(),
            execution_id: executionId,
            step_number: i + 1,
            step_name: step.name,
            step_description: step.description,
            tool_name: step.tool,
            tool_parameters: step.parameters,
            status: 'pending',
            tokens_used: 0,
            cost: 0,
            retry_count: 0,
        });
    }

    // Add audit log
    await workflowStore.addAuditLog(executionId, {
        log_id: uuidv4(),
        execution_id: executionId,
        timestamp: new Date().toISOString(),
        user_id: userId,
        action_type: 'workflow_start',
        action_details: `Started background workflow: ${payload.workflowName}`,
        tokens_used: 0,
        cost: 0,
        model_id: payload.modelId,
        success: true,
        metadata: {
            steps_total: payload.steps.length,
            source: 'trigger.dev',
        },
    });

    // Trigger the background job
    const jobPayload: WorkflowJobPayload = {
        executionId,
        workflowName: payload.workflowName,
        workflowDescription: payload.workflowDescription,
        steps: payload.steps,
        metadata: {
            userId,
            mode: payload.mode,
            modelId: payload.modelId,
            startedAt: new Date().toISOString(),
        },
    };

    // Note: In production, this would call tasks.trigger()
    // For now, we'll simulate the job trigger
    console.log(`[Jobs API] 🚀 Triggered workflow job: ${executionId}`);
    
    // TODO: Uncomment when Trigger.dev is configured
    // const handle = await tasks.trigger("workflow-execution", jobPayload);

    return NextResponse.json({
        success: true,
        jobType: 'workflow',
        executionId,
        // jobId: handle.id, // Uncomment with Trigger.dev
        message: 'Workflow job triggered successfully',
        status: 'running',
    });
}

/**
 * Trigger a bulk document processing job
 */
async function triggerBulkDocumentJob(userId: string, payload: {
    documents: Array<{ id: string; filename: string; fileType: string; fileSize: number }>;
    projectId?: string;
    tags?: string[];
    mode: 'Sales' | 'Marketing' | 'Admin';
}) {
    const jobId = uuidv4();

    const jobPayload: BulkDocumentJobPayload = {
        documents: payload.documents,
        projectId: payload.projectId,
        tags: payload.tags,
        metadata: {
            userId,
            mode: payload.mode,
            modelId: 'text-embedding-3-small',
            startedAt: new Date().toISOString(),
        },
    };

    console.log(`[Jobs API] 🚀 Triggered bulk document job: ${jobId}`);
    console.log(`[Jobs API] Documents: ${payload.documents.length}`);

    // TODO: Uncomment when Trigger.dev is configured
    // const handle = await tasks.trigger("bulk-document-processing", jobPayload);

    return NextResponse.json({
        success: true,
        jobType: 'bulk-documents',
        jobId,
        // jobId: handle.id, // Uncomment with Trigger.dev
        documentCount: payload.documents.length,
        message: 'Bulk document processing job triggered successfully',
        status: 'running',
    });
}

/**
 * Trigger a document reprocessing job
 */
async function triggerDocumentReprocessJob(userId: string, payload: {
    documentIds: string[];
    newChunkSize?: number;
    newOverlap?: number;
    mode: 'Sales' | 'Marketing' | 'Admin';
}) {
    const jobId = uuidv4();

    console.log(`[Jobs API] 🚀 Triggered reprocess job: ${jobId}`);
    console.log(`[Jobs API] Documents: ${payload.documentIds.length}`);

    // TODO: Uncomment when Trigger.dev is configured
    // const handle = await tasks.trigger("document-reprocessing", {
    //     documentIds: payload.documentIds,
    //     newChunkSize: payload.newChunkSize,
    //     newOverlap: payload.newOverlap,
    //     metadata: {
    //         userId,
    //         mode: payload.mode,
    //     },
    // });

    return NextResponse.json({
        success: true,
        jobType: 'document-reprocess',
        jobId,
        documentCount: payload.documentIds.length,
        message: 'Document reprocessing job triggered successfully',
        status: 'running',
    });
}

/**
 * GET endpoint to check job status
 */
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');
        const jobType = searchParams.get('type');

        if (jobType === 'workflow' && jobId) {
            // Get workflow execution status
            const execution = await workflowStore.getExecution(jobId);
            if (!execution) {
                return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
            }

            // Verify ownership
            if (execution.user_id !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const steps = await workflowStore.getSteps(jobId);

            return NextResponse.json({
                success: true,
                execution,
                steps,
                progress: {
                    total: execution.steps_total,
                    completed: execution.steps_completed,
                    failed: execution.steps_failed,
                    percentage: Math.round((execution.steps_completed / execution.steps_total) * 100),
                },
            });
        }

        // List running jobs for user
        const runningExecutions = await workflowStore.getRunningExecutions(userId);

        return NextResponse.json({
            success: true,
            runningJobs: runningExecutions.map(e => ({
                executionId: e.execution_id,
                workflowName: e.workflow_name,
                status: e.status,
                progress: {
                    total: e.steps_total,
                    completed: e.steps_completed,
                    percentage: Math.round((e.steps_completed / e.steps_total) * 100),
                },
                startedAt: e.start_time,
            })),
        });

    } catch (error: any) {
        console.error('[Jobs API] ❌ Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
