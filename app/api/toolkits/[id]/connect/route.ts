// app/api/toolkits/[id]/connect/route.ts
// OAuth connection flow for toolkits via Composio

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// POST - Initiate OAuth connection
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { redirectUrl } = body;

        // Get user's toolkit installation
        const install = await query(`
            SELECT ut.*, tc.composio_app_id, tc.name, tc.auth_type
            FROM user_toolkits ut
            JOIN toolkit_catalog tc ON ut.toolkit_id = tc.id
            WHERE ut.user_id = $1 AND (ut.id = $2 OR ut.toolkit_id = $2)
        `, [userId, id]);

        if (install.length === 0) {
            return NextResponse.json(
                { error: 'Toolkit not installed' },
                { status: 404 }
            );
        }

        const toolkit = install[0];

        // For OAuth-based toolkits, initiate Composio connection
        if (toolkit.auth_type === 'oauth2') {
            const composioApiKey = process.env.COMPOSIO_API_KEY;
            
            if (!composioApiKey) {
                return NextResponse.json(
                    { error: 'Composio API key not configured' },
                    { status: 500 }
                );
            }

            // Create connection request with Composio
            const composioResponse = await fetch(
                'https://backend.composio.dev/api/v1/connectedAccounts',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': composioApiKey,
                    },
                    body: JSON.stringify({
                        integrationId: toolkit.composio_app_id,
                        entityId: userId,  // Use Clerk userId as entity
                        redirectUri: redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/tools?connected=${toolkit.composio_app_id}`,
                    }),
                }
            );

            if (!composioResponse.ok) {
                const errorData = await composioResponse.json().catch(() => ({}));
                console.error('[Composio] Connection error:', errorData);
                return NextResponse.json(
                    { error: 'Failed to initiate connection', details: errorData },
                    { status: 500 }
                );
            }

            const connectionData = await composioResponse.json();

            // Update toolkit status
            await query(
                `UPDATE user_toolkits SET status = 'pending', updated_at = NOW() WHERE id = $1`,
                [toolkit.id]
            );

            console.log(`[Toolkits] 🔗 OAuth initiated for ${toolkit.name} by user ${userId}`);

            return NextResponse.json({
                success: true,
                authUrl: connectionData.redirectUrl || connectionData.authUrl,
                connectionId: connectionData.id,
            });
        }

        // For API key auth, just mark as ready for configuration
        if (toolkit.auth_type === 'api_key') {
            return NextResponse.json({
                success: true,
                authType: 'api_key',
                message: 'Please provide your API key to connect',
                configRequired: ['apiKey'],
            });
        }

        // For no-auth toolkits, mark as connected immediately
        await query(
            `UPDATE user_toolkits SET status = 'connected', is_connected = true, updated_at = NOW() WHERE id = $1`,
            [toolkit.id]
        );

        return NextResponse.json({
            success: true,
            message: 'Toolkit connected successfully',
        });

    } catch (error: any) {
        console.error('[Toolkit Connect] Error:', error);
        return NextResponse.json(
            { error: 'Failed to initiate connection', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - Complete connection (e.g., API key submission)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { apiKey, connectionId, config } = body;

        // Get user's toolkit installation
        const install = await query(`
            SELECT ut.*, tc.composio_app_id, tc.name, tc.auth_type
            FROM user_toolkits ut
            JOIN toolkit_catalog tc ON ut.toolkit_id = tc.id
            WHERE ut.user_id = $1 AND (ut.id = $2 OR ut.toolkit_id = $2)
        `, [userId, id]);

        if (install.length === 0) {
            return NextResponse.json(
                { error: 'Toolkit not installed' },
                { status: 404 }
            );
        }

        const toolkit = install[0];

        // For API key auth, validate and store
        if (toolkit.auth_type === 'api_key' && apiKey) {
            // TODO: Validate API key with the service
            
            // Store securely (in production, use proper secrets management)
            await query(
                `UPDATE user_toolkits SET 
                    status = 'connected',
                    is_connected = true,
                    custom_config = custom_config || $1::jsonb,
                    updated_at = NOW()
                 WHERE id = $2`,
                [JSON.stringify({ hasApiKey: true }), toolkit.id]
            );

            console.log(`[Toolkits] 🔑 API key connected for ${toolkit.name} by user ${userId}`);

            return NextResponse.json({
                success: true,
                message: 'API key configured successfully',
            });
        }

        // For OAuth callback completion
        if (connectionId) {
            await query(
                `UPDATE user_toolkits SET 
                    status = 'connected',
                    is_connected = true,
                    connection_id = $1,
                    connected_account = $2::jsonb,
                    updated_at = NOW()
                 WHERE id = $3`,
                [connectionId, JSON.stringify(config || {}), toolkit.id]
            );

            console.log(`[Toolkits] ✅ OAuth completed for ${toolkit.name} by user ${userId}`);

            return NextResponse.json({
                success: true,
                message: 'Connection completed successfully',
            });
        }

        return NextResponse.json(
            { error: 'Missing required parameters' },
            { status: 400 }
        );

    } catch (error: any) {
        console.error('[Toolkit Connect] PUT Error:', error);
        return NextResponse.json(
            { error: 'Failed to complete connection', details: error.message },
            { status: 500 }
        );
    }
}
