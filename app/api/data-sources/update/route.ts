// app/api/data-sources/update/route.ts
// Update data source status
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
        const { dataSourceId, ...updates } = body;

        if (!dataSourceId) {
            return NextResponse.json(
                { error: 'dataSourceId is required' },
                { status: 400 }
            );
        }

        // Build update query
        const updateFields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        const fieldMappings: Record<string, string> = {
            connectionStatus: 'connection_status',
            lastSyncAt: 'last_sync_at',
            lastSyncStatus: 'last_sync_status',
            lastSyncError: 'last_sync_error',
            totalItemsSynced: 'total_items_synced',
            isActive: 'is_active',
        };

        for (const [key, value] of Object.entries(updates)) {
            const dbField = fieldMappings[key];
            if (dbField && value !== undefined) {
                updateFields.push(`${dbField} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (updateFields.length === 0) {
            return NextResponse.json({ success: true, message: 'No updates' });
        }

        // Always update updated_at
        updateFields.push('updated_at = NOW()');

        values.push(dataSourceId);

        await query(
            `UPDATE data_sources SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        console.log(`[DataSource Update] ✅ Updated ${dataSourceId}:`, Object.keys(updates));

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[DataSource Update] ❌ Error:', error.message);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
