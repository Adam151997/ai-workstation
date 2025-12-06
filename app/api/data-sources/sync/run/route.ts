// app/api/data-sources/sync/run/route.ts
// Execute ETL sync using actual connectors
// Called by Trigger.dev background job

import { NextRequest, NextResponse } from 'next/server';
import { runETLSync } from '@/lib/etl';

export const maxDuration = 300; // 5 minutes max

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

        const { syncJobId, dataSourceId, userId, jobType } = await req.json();

        if (!dataSourceId || !userId) {
            return NextResponse.json(
                { error: 'dataSourceId and userId are required' },
                { status: 400 }
            );
        }

        console.log(`[ETL Run] Starting sync: ${dataSourceId} for user ${userId}`);

        // Run the actual sync using connectors
        const result = await runETLSync(dataSourceId, userId, jobType || 'manual');

        console.log(`[ETL Run] ✅ Sync complete:`, result);

        return NextResponse.json({
            success: true,
            syncJobId,
            ...result,
        });

    } catch (error: any) {
        console.error('[ETL Run] ❌ Error:', error.message);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
