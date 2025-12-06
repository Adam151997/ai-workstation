// app/api/toolkits/[id]/route.ts
// Individual toolkit management (uninstall, update, details)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// GET - Get toolkit details
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { userId } = await auth();

        // Get catalog details
        const toolkit = await query(
            'SELECT * FROM toolkit_catalog WHERE id = $1 OR slug = $1',
            [id]
        );

        if (toolkit.length === 0) {
            return NextResponse.json({ error: 'Toolkit not found' }, { status: 404 });
        }

        // Check if user has installed
        let userInstall = null;
        if (userId) {
            const install = await query(
                'SELECT * FROM user_toolkits WHERE user_id = $1 AND toolkit_id = $2',
                [userId, toolkit[0].id]
            );
            userInstall = install[0] || null;
        }

        return NextResponse.json({
            toolkit: toolkit[0],
            userInstall,
            isInstalled: !!userInstall,
        });

    } catch (error: any) {
        console.error('[Toolkit] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch toolkit', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update user's toolkit settings
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
        const { enabledActions, disabledActions, status, customConfig } = body;

        // Find user's installation
        const install = await query(
            'SELECT * FROM user_toolkits WHERE user_id = $1 AND (id = $2 OR toolkit_id = $2)',
            [userId, id]
        );

        if (install.length === 0) {
            return NextResponse.json(
                { error: 'Toolkit not installed' },
                { status: 404 }
            );
        }

        // Build update query
        const updates: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramIndex = 1;

        if (enabledActions !== undefined) {
            updates.push(`enabled_actions = $${paramIndex}`);
            values.push(enabledActions);
            paramIndex++;
        }

        if (disabledActions !== undefined) {
            updates.push(`disabled_actions = $${paramIndex}`);
            values.push(disabledActions);
            paramIndex++;
        }

        if (status !== undefined) {
            updates.push(`status = $${paramIndex}`);
            values.push(status);
            paramIndex++;
        }

        if (customConfig !== undefined) {
            updates.push(`custom_config = $${paramIndex}`);
            values.push(JSON.stringify(customConfig));
            paramIndex++;
        }

        values.push(install[0].id);

        const result = await query(
            `UPDATE user_toolkits SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        return NextResponse.json({
            success: true,
            toolkit: result[0],
        });

    } catch (error: any) {
        console.error('[Toolkit] Update error:', error);
        return NextResponse.json(
            { error: 'Failed to update toolkit', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Uninstall toolkit
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Find and delete user's installation
        const install = await query(
            'SELECT * FROM user_toolkits WHERE user_id = $1 AND (id = $2 OR toolkit_id = $2)',
            [userId, id]
        );

        if (install.length === 0) {
            return NextResponse.json(
                { error: 'Toolkit not installed' },
                { status: 404 }
            );
        }

        // Delete
        await query(
            'DELETE FROM user_toolkits WHERE id = $1',
            [install[0].id]
        );

        // Decrement install count
        if (install[0].toolkit_id) {
            await query(
                'UPDATE toolkit_catalog SET install_count = GREATEST(install_count - 1, 0) WHERE id = $1',
                [install[0].toolkit_id]
            );
        }

        console.log(`[Toolkits] 🗑️ User ${userId} uninstalled toolkit ${id}`);

        return NextResponse.json({
            success: true,
            message: 'Toolkit uninstalled',
        });

    } catch (error: any) {
        console.error('[Toolkit] Delete error:', error);
        return NextResponse.json(
            { error: 'Failed to uninstall toolkit', details: error.message },
            { status: 500 }
        );
    }
}
