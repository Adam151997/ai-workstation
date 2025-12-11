// app/api/errors/log/route.ts
// Client-side error logging endpoint

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

interface ErrorLogPayload {
    message: string;
    stack?: string;
    componentStack?: string;
    url: string;
    userAgent: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        const body: ErrorLogPayload = await req.json();

        // Log to console in development
        console.error('[Client Error]', {
            userId: userId || 'anonymous',
            message: body.message,
            url: body.url,
            timestamp: body.timestamp,
        });

        // Try to log to database
        try {
            await query(
                `INSERT INTO error_logs (
                    user_id,
                    error_message,
                    error_stack,
                    component_stack,
                    url,
                    user_agent,
                    metadata,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    userId || null,
                    body.message?.substring(0, 1000), // Truncate to prevent overflow
                    body.stack?.substring(0, 5000),
                    body.componentStack?.substring(0, 5000),
                    body.url?.substring(0, 500),
                    body.userAgent?.substring(0, 500),
                    JSON.stringify(body.metadata || {}),
                    body.timestamp || new Date().toISOString(),
                ]
            );
        } catch (dbError) {
            // Table might not exist, just log to console
            console.error('[Error Logging] Failed to log to DB:', dbError);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        // Don't throw errors from the error logging endpoint
        console.error('[Error Logging] Failed to process error:', error);
        return NextResponse.json({ success: false }, { status: 200 });
    }
}
