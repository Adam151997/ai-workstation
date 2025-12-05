// app/api/setup/billing/route.ts
// Setup endpoint to run billing system migration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Setup] Running billing system migration...');

        // Read migration file
        const migrationPath = path.join(process.cwd(), 'migrations', '008_billing_system.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

        // Execute migration
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(migrationSQL);
            await client.query('COMMIT');
            console.log('[Setup] ✅ Billing migration completed successfully');
        } catch (error: any) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        // Check what was created
        const tables = await pool.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN (
                'subscription_tiers', 
                'user_subscriptions', 
                'usage_records', 
                'usage_aggregates',
                'billing_periods',
                'rate_limit_windows',
                'payment_history'
            )
        `);

        const tiers = await pool.query(`SELECT name, display_name, price_monthly FROM subscription_tiers`);

        return NextResponse.json({
            success: true,
            message: 'Billing system migration completed',
            tablesCreated: tables.rows.map(r => r.tablename),
            subscriptionTiers: tiers.rows,
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Billing migration error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to run billing migration', 
                details: error.message,
                hint: error.hint || null,
            },
            { status: 500 }
        );
    }
}
