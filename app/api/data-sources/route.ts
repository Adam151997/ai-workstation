// app/api/data-sources/route.ts
// Data Sources API - CRUD for external data connections

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// Supported data source types
const SUPPORTED_SOURCES = [
    'google_drive',
    'gmail', 
    'notion',
    'slack',
    'dropbox',
    'onedrive',
] as const;

type SourceType = typeof SUPPORTED_SOURCES[number];

// GET - List all data sources for user
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const sourceType = searchParams.get('type');
        const includeInactive = searchParams.get('includeInactive') === 'true';

        let sql = `
            SELECT 
                ds.id,
                ds.name,
                ds.source_type,
                ds.connection_status,
                ds.last_sync_at,
                ds.last_sync_status,
                ds.last_sync_error,
                ds.total_items_synced,
                ds.sync_frequency,
                ds.is_active,
                ds.config,
                ds.created_at,
                ds.updated_at,
                (SELECT COUNT(*) FROM sync_items si WHERE si.data_source_id = ds.id) as item_count,
                (SELECT COUNT(*) FROM sync_jobs sj WHERE sj.data_source_id = ds.id AND sj.status = 'running') as running_jobs
            FROM data_sources ds
            WHERE ds.user_id = $1
        `;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (sourceType) {
            sql += ` AND ds.source_type = $${paramIndex++}`;
            params.push(sourceType);
        }

        if (!includeInactive) {
            sql += ` AND ds.is_active = true`;
        }

        sql += ` ORDER BY ds.name ASC`;

        const sources = await query(sql, params);

        return NextResponse.json({
            success: true,
            dataSources: sources.map(formatDataSource),
            supportedTypes: SUPPORTED_SOURCES,
        });

    } catch (error: any) {
        console.error('[DataSources] ❌ List error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch data sources', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new data source connection
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name, sourceType, config, syncFrequency } = body;

        // Validate source type
        if (!SUPPORTED_SOURCES.includes(sourceType)) {
            return NextResponse.json(
                { error: `Invalid source type. Supported: ${SUPPORTED_SOURCES.join(', ')}` },
                { status: 400 }
            );
        }

        if (!name || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Data source name is required' },
                { status: 400 }
            );
        }

        // Check for duplicate name
        const existing = await query(
            `SELECT id FROM data_sources WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
            [userId, name.trim()]
        );

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'A data source with this name already exists' },
                { status: 409 }
            );
        }

        const result = await query(
            `INSERT INTO data_sources (user_id, name, source_type, config, sync_frequency, connection_status)
             VALUES ($1, $2, $3, $4, $5, 'disconnected')
             RETURNING *`,
            [
                userId, 
                name.trim(), 
                sourceType, 
                JSON.stringify(config || {}),
                syncFrequency || 'manual',
            ]
        );

        console.log(`[DataSources] ✅ Created: ${name} (${sourceType})`);

        return NextResponse.json({
            success: true,
            dataSource: formatDataSource(result[0]),
            message: 'Data source created. Connect to start syncing.',
        });

    } catch (error: any) {
        console.error('[DataSources] ❌ Create error:', error);
        return NextResponse.json(
            { error: 'Failed to create data source', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a data source
export async function PUT(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, name, config, syncFrequency, isActive } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Data source ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership
        const existing = await query(
            `SELECT id FROM data_sources WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Data source not found' },
                { status: 404 }
            );
        }

        // Build update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name.trim());
        }
        if (config !== undefined) {
            updates.push(`config = $${paramIndex++}`);
            values.push(JSON.stringify(config));
        }
        if (syncFrequency !== undefined) {
            updates.push(`sync_frequency = $${paramIndex++}`);
            values.push(syncFrequency);
        }
        if (isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(isActive);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        values.push(id);

        const result = await query(
            `UPDATE data_sources SET ${updates.join(', ')}, updated_at = NOW() 
             WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        console.log(`[DataSources] ✅ Updated: ${id}`);

        return NextResponse.json({
            success: true,
            dataSource: formatDataSource(result[0]),
        });

    } catch (error: any) {
        console.error('[DataSources] ❌ Update error:', error);
        return NextResponse.json(
            { error: 'Failed to update data source', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a data source
export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Data source ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership
        const existing = await query(
            `SELECT id, name FROM data_sources WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Data source not found' },
                { status: 404 }
            );
        }

        // Delete (cascade will remove sync_jobs, sync_items, scheduled_syncs)
        await query(`DELETE FROM data_sources WHERE id = $1`, [id]);

        console.log(`[DataSources] ✅ Deleted: ${existing[0].name}`);

        return NextResponse.json({
            success: true,
            message: 'Data source and all related data deleted',
        });

    } catch (error: any) {
        console.error('[DataSources] ❌ Delete error:', error);
        return NextResponse.json(
            { error: 'Failed to delete data source', details: error.message },
            { status: 500 }
        );
    }
}

// Helper function to format data source response
function formatDataSource(row: any) {
    return {
        id: row.id,
        name: row.name,
        sourceType: row.source_type,
        connectionStatus: row.connection_status,
        lastSyncAt: row.last_sync_at,
        lastSyncStatus: row.last_sync_status,
        lastSyncError: row.last_sync_error,
        totalItemsSynced: parseInt(row.total_items_synced) || 0,
        syncFrequency: row.sync_frequency,
        isActive: row.is_active,
        config: row.config || {},
        itemCount: parseInt(row.item_count) || 0,
        runningJobs: parseInt(row.running_jobs) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
