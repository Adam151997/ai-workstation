// app/api/billing/subscription/route.ts
// Subscription management API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
    getUserSubscription, 
    createUserSubscription,
    getUserTierLimits,
    getSubscriptionTiers
} from '@/lib/billing';

// GET - Get current subscription
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const subscription = await getUserSubscription(userId);
        const tier = await getUserTierLimits(userId);

        return NextResponse.json({
            success: true,
            subscription: subscription || {
                tierName: 'free',
                status: 'active',
                billingPeriod: 'monthly',
            },
            tier: {
                name: tier.name,
                displayName: tier.displayName,
                tokensPerMonth: tier.tokensPerMonth,
                requestsPerDay: tier.requestsPerDay,
                requestsPerMinute: tier.requestsPerMinute,
                maxDocuments: tier.maxDocuments,
                maxProjects: tier.maxProjects,
                maxFileSizeMb: tier.maxFileSizeMb,
                features: tier.features,
            },
        });
    } catch (error: any) {
        console.error('[Billing] Subscription GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch subscription', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create or update subscription
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { tierName = 'free', billingPeriod = 'monthly' } = body;

        // Validate tier exists
        const tiers = await getSubscriptionTiers();
        const selectedTier = tiers.find(t => t.name === tierName);
        if (!selectedTier) {
            return NextResponse.json(
                { error: 'Invalid tier name' },
                { status: 400 }
            );
        }

        // For paid tiers, we would redirect to Stripe here
        // For now, just create/update the subscription
        if (selectedTier.priceMonthly > 0) {
            // TODO: Integrate with Stripe checkout
            return NextResponse.json({
                success: false,
                requiresPayment: true,
                message: 'Paid tier upgrade requires payment. Stripe integration coming soon.',
                tier: selectedTier,
            });
        }

        const subscription = await createUserSubscription(userId, tierName, billingPeriod);

        return NextResponse.json({
            success: true,
            subscription,
            message: `Subscription updated to ${selectedTier.displayName}`,
        });
    } catch (error: any) {
        console.error('[Billing] Subscription POST error:', error);
        return NextResponse.json(
            { error: 'Failed to update subscription', details: error.message },
            { status: 500 }
        );
    }
}
