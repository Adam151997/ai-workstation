// app/api/memories/route.ts
// Agent Memories API - List, search, and manage memories

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { logMemoryAction } from '@/lib/audit';

// GET - List memories with filtering and search
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const type = searchParams.get('type');
        const source = searchParams.get('source');
        const search = searchParams.get('search');
        const minRelevance = parseFloat(searchParams.get('minRelevance') || '0');

        let sql = `
            SELECT 
                id, type, content, source, relevance, metadata,
                created_at, updated_at, expires_at,
                CASE WHEN embedding IS NOT NULL THEN true ELSE false END as has_embedding
            FROM agent_memories
            WHERE user_id = $1
        `;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (type) {
            sql += ` AND type = $${paramIndex++}`;
            params.push(type);
        }

        if (source) {
            sql += ` AND source = $${paramIndex++}`;
            params.push(source);
        }

        if (minRelevance > 0) {
            sql += ` AND relevance >= $${paramIndex++}`;
            params.push(minRelevance);
        }

        if (search) {
            sql += ` AND content ILIKE $${paramIndex++}`;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY relevance DESC, created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const memories = await query(sql, params);

        // Get total count
        let countSql = `SELECT COUNT(*) as total FROM agent_memories WHERE user_id = $1`;
        const countParams: any[] = [userId];
        let countIndex = 2;

        if (type) {
            countSql += ` AND type = $${countIndex++}`;
            countParams.push(type);
        }
        if (source) {
            countSql += ` AND source = $${countIndex++}`;
            countParams.push(source);
        }
        if (minRelevance > 0) {
            countSql += ` AND relevance >= $${countIndex++}`;
            countParams.push(minRelevance);
        }
        if (search) {
            countSql += ` AND content ILIKE $${countIndex++}`;
            countParams.push(`%${search}%`);
        }

        const countResult = await query(countSql, countParams);
        const total = parseInt(countResult[0]?.total || '0');

        // Get stats
        const stats = await query(`
            SELECT 
                type,
                COUNT(*) as count,
                AVG(relevance) as avg_relevance
            FROM agent_memories
            WHERE user_id = $1
            GROUP BY type
        `, [userId]);

        return NextResponse.json({
            success: true,
            memories: memories.map((m: any) => ({
                id: m.id,
                type: m.type,
                content: m.content,
                source: m.source,
                relevance: parseFloat(m.relevance),
                metadata: m.metadata || {},
                hasEmbedding: m.has_embedding,
                createdAt: m.created_at,
                updatedAt: m.updated_at,
                expiresAt: m.expires_at,
            })),
            total,
            offset,
            limit,
            stats: stats.map((s: any) => ({
                type: s.type,
                count: parseInt(s.count),
                avgRelevance: parseFloat(s.avg_relevance || '0').toFixed(2),
            })),
        });
    } catch (error: any) {
        console.error('[Memories API] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a specific memory or bulk delete
export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const memoryId = searchParams.get('id');
        const deleteAll = searchParams.get('all') === 'true';
        const type = searchParams.get('type');

        if (deleteAll) {
            // Delete all memories (optionally filtered by type)
            let sql = `DELETE FROM agent_memories WHERE user_id = $1`;
            const params: any[] = [userId];

            if (type) {
                sql += ` AND type = $2`;
                params.push(type);
            }

            sql += ` RETURNING id`;
            const result = await query(sql, params);

            await logMemoryAction(userId, 'memory.delete', 'bulk', {
                count: result.length,
                type: type || 'all',
            });

            return NextResponse.json({
                success: true,
                deleted: result.length,
                message: `Deleted ${result.length} memories`,
            });
        }

        if (!memoryId) {
            return NextResponse.json(
                { error: 'Memory ID is required' },
                { status: 400 }
            );
        }

        // Delete single memory
        const result = await query(`
            DELETE FROM agent_memories 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `, [memoryId, userId]);

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Memory not found' },
                { status: 404 }
            );
        }

        await logMemoryAction(userId, 'memory.delete', memoryId);

        return NextResponse.json({
            success: true,
            deleted: 1,
            message: 'Memory deleted',
        });
    } catch (error: any) {
        console.error('[Memories API] Delete error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Manually store a memory or consolidate
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { action } = body;

        if (action === 'consolidate') {
            // Trigger memory consolidation
            const { consolidateMemories } = await import('@/lib/agents');
            const result = await consolidateMemories(userId);
            
            await logMemoryAction(userId, 'memory.consolidate', 'consolidation', {
                merged: result.merged,
                removed: result.removed,
            });

            return NextResponse.json({
                success: true,
                merged: result.merged,
                removed: result.removed,
                message: `Consolidated: ${result.merged} merged, ${result.removed} removed`,
            });
        }

        if (action === 'decay') {
            // Apply relevance decay to old memories
            const { decayOldMemories } = await import('@/lib/agents');
            const daysThreshold = body.daysThreshold || 30;
            const affected = await decayOldMemories(userId, daysThreshold);

            return NextResponse.json({
                success: true,
                affected,
                message: `Applied decay to ${affected} memories older than ${daysThreshold} days`,
            });
        }

        // Manual memory creation
        const { type, content, source, relevance } = body;

        if (!type || !content) {
            return NextResponse.json(
                { error: 'Type and content are required' },
                { status: 400 }
            );
        }

        const { storeMemory } = await import('@/lib/agents');
        const memory = await storeMemory(userId, {
            type,
            content,
            source: source || 'general',
            relevance: relevance || 0.5,
        }, true);

        await logMemoryAction(userId, 'memory.store', memory.id, {
            type,
            contentLength: content.length,
        });

        return NextResponse.json({
            success: true,
            memory,
        });
    } catch (error: any) {
        console.error('[Memories API] POST error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
