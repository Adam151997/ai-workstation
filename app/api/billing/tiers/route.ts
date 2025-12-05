// app/api/billing/tiers/route.ts
// Subscription tiers API

import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionTiers } from '@/lib/billing';

// GET - Get available subscription tiers (public)
export async function GET(req: NextRequest) {
    try {
        const tiers = await getSubscriptionTiers();

        return NextResponse.json({
            success: true,
            tiers: tiers.map(tier => ({
                name: tier.name,
                displayName: tier.displayName,
                description: tier.description,
                priceMonthly: tier.priceMonthly,
                priceYearly: tier.priceYearly,
                tokensPerMonth: tier.tokensPerMonth,
                requestsPerDay: tier.requestsPerDay,
                requestsPerMinute: tier.requestsPerMinute,
                maxDocuments: tier.maxDocuments,
                maxProjects: tier.maxProjects,
                maxFileSizeMb: tier.maxFileSizeMb,
                features: tier.features,
            })),
        });
    } catch (error: any) {
        console.error('[Billing] Tiers GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tiers', details: error.message },
            { status: 500 }
        );
    }
}
