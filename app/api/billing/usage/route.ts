// app/api/billing/usage/route.ts
// Usage data API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUsageSummary, getUsageHistory } from '@/lib/billing';
import { checkUserRateLimits } from '@/lib/billing/usage-tracker';

// GET - Get usage data
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'summary';
        const days = parseInt(searchParams.get('days') || '30');

        switch (type) {
            case 'summary': {
                const summary = await getUsageSummary(userId);
                const rateLimits = await checkUserRateLimits(userId);
                
                return NextResponse.json({
                    success: true,
                    summary,
                    rateLimits,
                });
            }

            case 'history': {
                const history = await getUsageHistory(userId, days);
                
                return NextResponse.json({
                    success: true,
                    history,
                    days,
                });
            }

            case 'rate-limits': {
                const rateLimits = await checkUserRateLimits(userId);
                
                return NextResponse.json({
                    success: true,
                    rateLimits,
                });
            }

            default:
                return NextResponse.json(
                    { error: 'Invalid type. Use: summary, history, or rate-limits' },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        console.error('[Billing] Usage GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch usage data', details: error.message },
            { status: 500 }
        );
    }
}
