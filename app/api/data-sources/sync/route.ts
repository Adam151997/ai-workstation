// app/api/data-sources/sync/route.ts
// Sync Jobs API - Trigger and monitor sync operations

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET - List sync jobs
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const dataSourceId = searchParams.get('dataSourceId');
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '20');

        let sql = `
            SELECT 
                sj.*,
                ds.name as source_name,
                ds.source_type,
                CASE 
                    WHEN sj.completed_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (sj.completed_at - sj.started_at))
                    ELSE NULL 
                END as duration_seconds
            FROM sync_jobs sj
            JOIN data_sources ds ON sj.data_source_id = ds.id
            WHERE sj.user_id = $1
        `;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (dataSourceId) {
            sql += ` AND sj.data_source_id = $${paramIndex++}`;
            params.push(dataSourceId);
        }

        if (status) {
            sql += ` AND sj.status = $${paramIndex++}`;
            params.push(status);
        }

        sql += ` ORDER BY sj.created_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const jobs = await query(sql, params);

        return NextResponse.json({
            success: true,
            syncJobs: jobs.map(formatSyncJob),
        });

    } catch (error: any) {
        console.error('[SyncJobs] ❌ List error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch sync jobs', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Trigger a new sync
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { dataSourceId, jobType = 'manual' } = body;

        if (!dataSourceId) {
            return NextResponse.json(
                { error: 'Data source ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership and get data source
        const sources = await query(
            `SELECT id, name, source_type, connection_status 
             FROM data_sources WHERE id = $1 AND user_id = $2`,
            [dataSourceId, userId]
        );

        if (sources.length === 0) {
            return NextResponse.json(
                { error: 'Data source not found' },
                { status: 404 }
            );
        }

        const source = sources[0];

        // Check if already syncing
        const runningJobs = await query(
            `SELECT id FROM sync_jobs 
             WHERE data_source_id = $1 AND status IN ('pending', 'running')`,
            [dataSourceId]
        );

        if (runningJobs.length > 0) {
            return NextResponse.json(
                { error: 'A sync is already in progress for this data source' },
                { status: 409 }
            );
        }

        // Create sync job
        const jobId = uuidv4();
        const result = await query(
            `INSERT INTO sync_jobs (id, user_id, data_source_id, job_type, status, started_at)
             VALUES ($1, $2, $3, $4, 'running', NOW())
             RETURNING *`,
            [jobId, userId, dataSourceId, jobType]
        );

        // Update data source status
        await query(
            `UPDATE data_sources SET connection_status = 'syncing' WHERE id = $1`,
            [dataSourceId]
        );

        console.log(`[SyncJobs] 🚀 Started sync: ${source.name} (${jobType})`);

        // TODO: In production, trigger the actual sync via Trigger.dev
        // For now, we'll simulate immediate completion for demo
        
        // Simulate sync completion (replace with actual Trigger.dev job)
        setTimeout(async () => {
            try {
                await query(
                    `UPDATE sync_jobs 
                     SET status = 'completed', completed_at = NOW(), items_found = 0, items_processed = 0
                     WHERE id = $1`,
                    [jobId]
                );
                await query(
                    `UPDATE data_sources 
                     SET connection_status = 'connected', last_sync_at = NOW(), last_sync_status = 'success'
                     WHERE id = $1`,
                    [dataSourceId]
                );
                console.log(`[SyncJobs] ✅ Completed sync: ${source.name}`);
            } catch (err) {
                console.error('[SyncJobs] ❌ Error completing sync:', err);
            }
        }, 2000);

        return NextResponse.json({
            success: true,
            syncJob: formatSyncJob({
                ...result[0],
                source_name: source.name,
                source_type: source.source_type,
            }),
            message: 'Sync started successfully',
        });

    } catch (error: any) {
        console.error('[SyncJobs] ❌ Start error:', error);
        return NextResponse.json(
            { error: 'Failed to start sync', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Cancel a running sync
export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json(
                { error: 'Job ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership
        const jobs = await query(
            `SELECT sj.id, sj.status, sj.data_source_id, ds.name
             FROM sync_jobs sj
             JOIN data_sources ds ON sj.data_source_id = ds.id
             WHERE sj.id = $1 AND sj.user_id = $2`,
            [jobId, userId]
        );

        if (jobs.length === 0) {
            return NextResponse.json(
                { error: 'Sync job not found' },
                { status: 404 }
            );
        }

        const job = jobs[0];

        if (!['pending', 'running'].includes(job.status)) {
            return NextResponse.json(
                { error: 'Can only cancel pending or running jobs' },
                { status: 400 }
            );
        }

        // Cancel the job
        await query(
            `UPDATE sync_jobs SET status = 'cancelled', completed_at = NOW() WHERE id = $1`,
            [jobId]
        );

        // Update data source status
        await query(
            `UPDATE data_sources SET connection_status = 'connected' WHERE id = $1`,
            [job.data_source_id]
        );

        console.log(`[SyncJobs] ⛔ Cancelled sync: ${job.name}`);

        return NextResponse.json({
            success: true,
            message: 'Sync cancelled',
        });

    } catch (error: any) {
        console.error('[SyncJobs] ❌ Cancel error:', error);
        return NextResponse.json(
            { error: 'Failed to cancel sync', details: error.message },
            { status: 500 }
        );
    }
}

// Helper function to format sync job response
function formatSyncJob(row: any) {
    return {
        id: row.id,
        dataSourceId: row.data_source_id,
        sourceName: row.source_name,
        sourceType: row.source_type,
        jobType: row.job_type,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds) : null,
        itemsFound: parseInt(row.items_found) || 0,
        itemsProcessed: parseInt(row.items_processed) || 0,
        itemsCreated: parseInt(row.items_created) || 0,
        itemsUpdated: parseInt(row.items_updated) || 0,
        itemsSkipped: parseInt(row.items_skipped) || 0,
        itemsFailed: parseInt(row.items_failed) || 0,
        bytesProcessed: parseInt(row.bytes_processed) || 0,
        errorMessage: row.error_message,
        errorDetails: row.error_details,
        progressData: row.progress_data || {},
        createdAt: row.created_at,
    };
}
