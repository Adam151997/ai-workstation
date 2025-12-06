// app/api/data-sources/sync/update/route.ts
// Update sync job status
// Called by Trigger.dev background job

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        // Verify internal trigger
        const isInternal = req.headers.get('x-internal-trigger') === 'true';
        if (!isInternal) {
            return NextResponse.json(
                { error: 'This endpoint is for internal use only' },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { syncJobId, ...updates } = body;

        if (!syncJobId) {
            return NextResponse.json(
                { error: 'syncJobId is required' },
                { status: 400 }
            );
        }

        // Build update query
        const updateFields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        const fieldMappings: Record<string, string> = {
            status: 'status',
            startedAt: 'started_at',
            completedAt: 'completed_at',
            itemsFound: 'items_found',
            itemsProcessed: 'items_processed',
            itemsCreated: 'items_created',
            itemsUpdated: 'items_updated',
            itemsSkipped: 'items_skipped',
            itemsFailed: 'items_failed',
            bytesProcessed: 'bytes_processed',
            errorMessage: 'error_message',
            errorDetails: 'error_details',
            progressData: 'progress_data',
        };

        for (const [key, value] of Object.entries(updates)) {
            const dbField = fieldMappings[key];
            if (dbField && value !== undefined) {
                updateFields.push(`${dbField} = $${paramIndex}`);
                values.push(key.includes('Details') || key.includes('Data') 
                    ? JSON.stringify(value) 
                    : value
                );
                paramIndex++;
            }
        }

        if (updateFields.length === 0) {
            return NextResponse.json({ success: true, message: 'No updates' });
        }

        values.push(syncJobId);

        await query(
            `UPDATE sync_jobs SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        console.log(`[Sync Update] ✅ Updated job ${syncJobId}:`, Object.keys(updates));

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Sync Update] ❌ Error:', error.message);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
