// app/api/audit/route.ts
// Audit Logs API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// GET - List audit logs
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const action = searchParams.get('action');
        const resource = searchParams.get('resource');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Use log_id instead of id (matches migration schema)
        // Use timestamp column which is the actual event time (created_at might be different)
        let sql = `
            SELECT 
                log_id as id,
                user_id,
                action,
                resource,
                resource_id,
                metadata,
                ip_address,
                user_agent,
                COALESCE(timestamp, created_at) as created_at
            FROM audit_logs
            WHERE user_id = $1
        `;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (action) {
            sql += ` AND action = $${paramIndex++}`;
            params.push(action);
        }

        if (resource) {
            sql += ` AND resource = $${paramIndex++}`;
            params.push(resource);
        }

        if (startDate) {
            sql += ` AND created_at >= $${paramIndex++}`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND created_at <= $${paramIndex++}`;
            params.push(endDate);
        }

        sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const logs = await query(sql, params);

        return NextResponse.json({
            success: true,
            logs: logs.map(log => {
                // The database stores timestamps in server local time
                // We need to return a proper ISO string that the client can parse correctly
                let createdAtISO: string;
                if (log.created_at instanceof Date) {
                    // Node.js pg driver returns Date objects in local time
                    // toISOString() converts to UTC
                    createdAtISO = log.created_at.toISOString();
                } else if (typeof log.created_at === 'string') {
                    // Parse and convert to ISO string
                    createdAtISO = new Date(log.created_at).toISOString();
                } else {
                    createdAtISO = new Date().toISOString();
                }

                return {
                    id: log.id,
                    userId: log.user_id,
                    action: log.action,
                    resource: log.resource,
                    resourceId: log.resource_id,
                    metadata: log.metadata || {},
                    ipAddress: log.ip_address,
                    userAgent: log.user_agent,
                    createdAt: createdAtISO,
                };
            }),
            offset,
            limit,
        });

    } catch (error: any) {
        console.error('[Audit] ❌ List error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch audit logs', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create audit log entry
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { action, resource, resourceId, metadata } = body;

        if (!action || !resource) {
            return NextResponse.json(
                { error: 'Action and resource are required' },
                { status: 400 }
            );
        }

        // Get IP and user agent from headers
        const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                         req.headers.get('x-real-ip') || 
                         'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        const result = await query(
            `INSERT INTO audit_logs (
                user_id, action, resource, resource_id, metadata, ip_address, user_agent,
                action_type, action_details, tokens_used, cost, success
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING log_id as id, created_at`,
            [
                userId, 
                action, 
                resource, 
                resourceId || null, 
                JSON.stringify(metadata || {}), 
                ipAddress, 
                userAgent,
                // Legacy required fields
                action.split('.')[1] || action,
                `${action} on ${resource}${resourceId ? ` (${resourceId})` : ''}`,
                0,
                0,
                true,
            ]
        );

        return NextResponse.json({
            success: true,
            logId: result[0].id,
            createdAt: result[0].created_at,
        });

    } catch (error: any) {
        console.error('[Audit] ❌ Create error:', error);
        return NextResponse.json(
            { error: 'Failed to create audit log', details: error.message },
            { status: 500 }
        );
    }
}
