// app/api/jobs/route.ts
// API endpoint to trigger and manage background jobs
// Tracks: Workflows, ETL Syncs, Notebook Runs, Document Processing

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
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

            case 'notebook': {
                return await triggerNotebookJob(userId, payload);
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

    console.log(`[Jobs API] 🚀 Triggered workflow job: ${executionId}`);

    return NextResponse.json({
        success: true,
        jobType: 'workflow',
        executionId,
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

    return NextResponse.json({
        success: true,
        jobType: 'bulk-documents',
        jobId,
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
 * Trigger a notebook execution job
 */
async function triggerNotebookJob(userId: string, payload: {
    notebookId: string;
    notebookName: string;
    cellCount: number;
}) {
    const jobId = uuidv4();

    // Update notebook status
    await query(
        `UPDATE notebooks SET status = 'running', last_run_at = NOW() WHERE id = $1 AND user_id = $2`,
        [payload.notebookId, userId]
    );

    console.log(`[Jobs API] 🚀 Triggered notebook job: ${jobId}`);

    return NextResponse.json({
        success: true,
        jobType: 'notebook',
        jobId,
        notebookId: payload.notebookId,
        message: 'Notebook execution job triggered successfully',
        status: 'running',
    });
}

/**
 * GET endpoint - List all jobs (workflows + ETL syncs + notebooks)
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
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        // If specific job requested
        if (jobType === 'workflow' && jobId) {
            const execution = await workflowStore.getExecution(jobId);
            if (!execution) {
                return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
            }

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

        // Fetch all jobs from multiple sources
        const jobs: any[] = [];

        // 1. Workflow Executions
        try {
            const workflowSql = `
                SELECT 
                    execution_id as id,
                    'workflow' as type,
                    workflow_name as name,
                    status,
                    start_time as started_at,
                    end_time as completed_at,
                    steps_total,
                    steps_completed,
                    steps_failed,
                    total_tokens,
                    total_cost,
                    error_message as error,
                    metadata
                FROM workflow_executions
                WHERE user_id = $1
                ORDER BY start_time DESC
                LIMIT $2
            `;
            const workflows = await query(workflowSql, [userId, limit]);
            
            for (const w of workflows) {
                jobs.push({
                    id: w.id,
                    type: 'workflow',
                    name: w.name || 'Workflow',
                    status: w.status,
                    startedAt: w.started_at,
                    completedAt: w.completed_at,
                    progress: w.steps_total > 0 
                        ? Math.round((w.steps_completed / w.steps_total) * 100) 
                        : 0,
                    error: w.error,
                    metadata: {
                        stepsTotal: w.steps_total,
                        stepsCompleted: w.steps_completed,
                        stepsFailed: w.steps_failed,
                        tokensUsed: w.total_tokens,
                        cost: w.total_cost,
                        ...w.metadata,
                    },
                });
            }
        } catch (e) {
            console.log('[Jobs] No workflow executions table or error:', e);
        }

        // 2. ETL Sync Jobs
        try {
            const etlSql = `
                SELECT 
                    sj.id,
                    'etl' as type,
                    ds.source_name as name,
                    ds.source_type,
                    sj.status,
                    sj.started_at,
                    sj.completed_at,
                    sj.items_found,
                    sj.items_processed,
                    sj.items_created,
                    sj.items_updated,
                    sj.items_skipped,
                    sj.items_failed,
                    sj.error_message as error,
                    sj.progress_data as metadata
                FROM sync_jobs sj
                JOIN data_sources ds ON sj.data_source_id = ds.id
                WHERE sj.user_id = $1
                ORDER BY sj.started_at DESC
                LIMIT $2
            `;
            const etlJobs = await query(etlSql, [userId, limit]);
            
            for (const e of etlJobs) {
                jobs.push({
                    id: e.id,
                    type: 'etl',
                    name: `${e.source_type}: ${e.name || 'Sync'}`,
                    status: e.status,
                    startedAt: e.started_at,
                    completedAt: e.completed_at,
                    progress: e.items_found > 0 
                        ? Math.round((e.items_processed / e.items_found) * 100) 
                        : 0,
                    error: e.error,
                    metadata: {
                        sourceType: e.source_type,
                        itemsFound: e.items_found,
                        itemsProcessed: e.items_processed,
                        itemsCreated: e.items_created,
                        itemsUpdated: e.items_updated,
                        itemsSkipped: e.items_skipped,
                        itemsFailed: e.items_failed,
                        ...e.metadata,
                    },
                });
            }
        } catch (e) {
            console.log('[Jobs] No sync_jobs table or error:', e);
        }

        // 3. Notebook Runs (from notebooks table with recent runs)
        try {
            const notebookSql = `
                SELECT 
                    id,
                    'notebook' as type,
                    title as name,
                    status,
                    last_run_at as started_at,
                    CASE 
                        WHEN status IN ('completed', 'failed') THEN updated_at 
                        ELSE NULL 
                    END as completed_at,
                    (SELECT COUNT(*) FROM notebook_cells WHERE notebook_id = notebooks.id) as cell_count,
                    (SELECT COUNT(*) FROM notebook_cells WHERE notebook_id = notebooks.id AND status = 'success') as cells_completed,
                    (SELECT COUNT(*) FROM notebook_cells WHERE notebook_id = notebooks.id AND status = 'error') as cells_failed,
                    error_message as error
                FROM notebooks
                WHERE user_id = $1 
                AND last_run_at IS NOT NULL
                ORDER BY last_run_at DESC
                LIMIT $2
            `;
            const notebookJobs = await query(notebookSql, [userId, limit]);
            
            for (const n of notebookJobs) {
                const cellCount = parseInt(n.cell_count) || 0;
                const cellsCompleted = parseInt(n.cells_completed) || 0;
                jobs.push({
                    id: n.id,
                    type: 'notebook',
                    name: n.name || 'Notebook',
                    status: n.status === 'idle' ? 'completed' : n.status,
                    startedAt: n.started_at,
                    completedAt: n.completed_at,
                    progress: cellCount > 0 
                        ? Math.round((cellsCompleted / cellCount) * 100) 
                        : 0,
                    error: n.error,
                    metadata: {
                        cellCount,
                        cellsCompleted,
                        cellsFailed: parseInt(n.cells_failed) || 0,
                    },
                });
            }
        } catch (e) {
            console.log('[Jobs] No notebooks table or error:', e);
        }

        // Sort by started_at descending
        jobs.sort((a, b) => {
            const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
            const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
            return bTime - aTime;
        });

        // Filter by status if provided
        const filteredJobs = status && status !== 'all'
            ? jobs.filter(j => j.status === status)
            : jobs;

        // Filter by type if provided
        const typeFilteredJobs = jobType && jobType !== 'all'
            ? filteredJobs.filter(j => j.type === jobType)
            : filteredJobs;

        // Calculate stats
        const stats = {
            total: jobs.length,
            running: jobs.filter(j => j.status === 'running').length,
            completed: jobs.filter(j => j.status === 'completed').length,
            failed: jobs.filter(j => j.status === 'failed').length,
            pending: jobs.filter(j => j.status === 'pending').length,
            byType: {
                workflow: jobs.filter(j => j.type === 'workflow').length,
                etl: jobs.filter(j => j.type === 'etl').length,
                notebook: jobs.filter(j => j.type === 'notebook').length,
            },
        };

        return NextResponse.json({
            success: true,
            jobs: typeFilteredJobs.slice(0, limit),
            stats,
        });

    } catch (error: any) {
        console.error('[Jobs API] ❌ Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE endpoint - Cancel a running job
 */
export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');
        const jobType = searchParams.get('type');

        if (!jobId || !jobType) {
            return NextResponse.json(
                { error: 'jobId and type are required' },
                { status: 400 }
            );
        }

        switch (jobType) {
            case 'workflow':
                await query(
                    `UPDATE workflow_executions 
                     SET status = 'cancelled', end_time = NOW(), error_message = 'Cancelled by user'
                     WHERE execution_id = $1 AND user_id = $2 AND status = 'running'`,
                    [jobId, userId]
                );
                break;

            case 'etl':
                await query(
                    `UPDATE sync_jobs 
                     SET status = 'cancelled', completed_at = NOW(), error_message = 'Cancelled by user'
                     WHERE id = $1 AND user_id = $2 AND status = 'running'`,
                    [jobId, userId]
                );
                break;

            case 'notebook':
                await query(
                    `UPDATE notebooks 
                     SET status = 'idle', error_message = 'Cancelled by user'
                     WHERE id = $1 AND user_id = $2 AND status = 'running'`,
                    [jobId, userId]
                );
                break;

            default:
                return NextResponse.json(
                    { error: `Unknown job type: ${jobType}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            message: 'Job cancelled successfully',
        });

    } catch (error: any) {
        console.error('[Jobs API] ❌ Cancel error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

/**
 * PATCH endpoint - Retry a failed job
 */
export async function PATCH(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { jobId, jobType, action } = body;

        if (!jobId || !jobType || action !== 'retry') {
            return NextResponse.json(
                { error: 'jobId, type, and action=retry are required' },
                { status: 400 }
            );
        }

        switch (jobType) {
            case 'workflow':
                await query(
                    `UPDATE workflow_executions 
                     SET status = 'pending', end_time = NULL, error_message = NULL,
                         steps_completed = 0, steps_failed = 0
                     WHERE execution_id = $1 AND user_id = $2 AND status = 'failed'`,
                    [jobId, userId]
                );
                // Reset all steps to pending
                await query(
                    `UPDATE workflow_steps 
                     SET status = 'pending', error_message = NULL, result = NULL
                     WHERE execution_id = $1`,
                    [jobId]
                );
                break;

            case 'etl':
                await query(
                    `UPDATE sync_jobs 
                     SET status = 'pending', completed_at = NULL, error_message = NULL,
                         items_processed = 0, items_created = 0, items_updated = 0, 
                         items_skipped = 0, items_failed = 0
                     WHERE id = $1 AND user_id = $2 AND status = 'failed'`,
                    [jobId, userId]
                );
                break;

            case 'notebook':
                await query(
                    `UPDATE notebooks 
                     SET status = 'pending', error_message = NULL
                     WHERE id = $1 AND user_id = $2 AND status = 'failed'`,
                    [jobId, userId]
                );
                // Reset failed cells
                await query(
                    `UPDATE notebook_cells 
                     SET status = 'idle', error = NULL, output = NULL
                     WHERE notebook_id = $1 AND status = 'error'`,
                    [jobId]
                );
                break;

            default:
                return NextResponse.json(
                    { error: `Unknown job type: ${jobType}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            message: 'Job queued for retry',
        });

    } catch (error: any) {
        console.error('[Jobs API] ❌ Retry error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
