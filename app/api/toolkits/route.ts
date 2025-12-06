// app/api/toolkits/route.ts
// Toolkit catalog and user toolkit management

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// GET - List toolkit catalog or user's installed toolkits
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        const { searchParams } = new URL(req.url);
        
        const view = searchParams.get('view') || 'catalog';  // 'catalog' | 'installed'
        const category = searchParams.get('category');
        const search = searchParams.get('search');
        const featured = searchParams.get('featured');

        if (view === 'installed') {
            // User must be authenticated to see installed toolkits
            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const installedToolkits = await query(`
                SELECT 
                    ut.*,
                    tc.name,
                    tc.slug,
                    tc.description,
                    tc.icon_url,
                    tc.category,
                    tc.auth_type,
                    tc.tool_count
                FROM user_toolkits ut
                LEFT JOIN toolkit_catalog tc ON ut.toolkit_id = tc.id
                WHERE ut.user_id = $1
                ORDER BY ut.installed_at DESC
            `, [userId]);

            return NextResponse.json({
                toolkits: installedToolkits,
                count: installedToolkits.length,
            });
        }

        // Catalog view - public
        let catalogQuery = `
            SELECT 
                tc.*,
                (SELECT COUNT(*) FROM user_toolkits WHERE toolkit_id = tc.id) as user_install_count
            FROM toolkit_catalog tc
            WHERE tc.is_active = true
        `;
        const params: any[] = [];
        let paramIndex = 1;

        if (category && category !== 'all') {
            catalogQuery += ` AND tc.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (search) {
            catalogQuery += ` AND (tc.name ILIKE $${paramIndex} OR tc.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (featured === 'true') {
            catalogQuery += ` AND tc.is_featured = true`;
        }

        catalogQuery += ` ORDER BY tc.is_featured DESC, tc.install_count DESC, tc.name ASC`;

        const toolkits = await query(catalogQuery, params);

        // Get categories
        const categories = await query(`
            SELECT * FROM toolkit_categories ORDER BY display_order
        `);

        // If user is authenticated, mark which ones are installed
        let installedIds: string[] = [];
        if (userId) {
            const installed = await query(
                'SELECT toolkit_id FROM user_toolkits WHERE user_id = $1',
                [userId]
            );
            installedIds = installed.map((i: any) => i.toolkit_id);
        }

        return NextResponse.json({
            toolkits: toolkits.map((t: any) => ({
                ...t,
                isInstalled: installedIds.includes(t.id),
            })),
            categories,
            count: toolkits.length,
        });

    } catch (error: any) {
        console.error('[Toolkits] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch toolkits', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Install a toolkit
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { toolkitId, customMcpUrl, customName, customConfig } = body;

        if (!toolkitId && !customMcpUrl) {
            return NextResponse.json(
                { error: 'Either toolkitId or customMcpUrl is required' },
                { status: 400 }
            );
        }

        // Check if already installed
        if (toolkitId) {
            const existing = await query(
                'SELECT id FROM user_toolkits WHERE user_id = $1 AND toolkit_id = $2',
                [userId, toolkitId]
            );

            if (existing.length > 0) {
                return NextResponse.json(
                    { error: 'Toolkit already installed' },
                    { status: 400 }
                );
            }

            // Verify toolkit exists
            const toolkit = await query(
                'SELECT * FROM toolkit_catalog WHERE id = $1 AND is_active = true',
                [toolkitId]
            );

            if (toolkit.length === 0) {
                return NextResponse.json(
                    { error: 'Toolkit not found' },
                    { status: 404 }
                );
            }
        }

        // Insert user toolkit
        const result = await query(`
            INSERT INTO user_toolkits (
                user_id, toolkit_id, custom_name, custom_mcp_url, custom_config, status
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            userId,
            toolkitId || null,
            customName || null,
            customMcpUrl || null,
            JSON.stringify(customConfig || {}),
            toolkitId ? 'pending' : 'connected'  // Custom MCPs are immediately "connected"
        ]);

        // Update install count
        if (toolkitId) {
            await query(
                'UPDATE toolkit_catalog SET install_count = install_count + 1 WHERE id = $1',
                [toolkitId]
            );
        }

        console.log(`[Toolkits] ✅ User ${userId} installed toolkit ${toolkitId || customName}`);

        return NextResponse.json({
            success: true,
            toolkit: result[0],
            message: toolkitId 
                ? 'Toolkit installed. Connect your account to activate.'
                : 'Custom MCP toolkit added.',
        });

    } catch (error: any) {
        console.error('[Toolkits] Install error:', error);
        return NextResponse.json(
            { error: 'Failed to install toolkit', details: error.message },
            { status: 500 }
        );
    }
}
