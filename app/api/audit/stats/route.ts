// app/api/audit/stats/route.ts
// Get audit statistics by resource type

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get today's date range
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Get counts by resource for today
        const stats = await query(`
            SELECT resource, COUNT(*) as count
            FROM audit_logs
            WHERE user_id = $1 AND created_at >= $2
            GROUP BY resource
            ORDER BY count DESC
        `, [userId, todayStart.toISOString()]);

        // Convert to object
        const statsObj: Record<string, number> = {};
        for (const row of stats) {
            statsObj[row.resource] = parseInt(row.count);
        }

        return NextResponse.json({
            success: true,
            stats: statsObj,
        });
    } catch (error: any) {
        console.error('[Audit Stats] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
