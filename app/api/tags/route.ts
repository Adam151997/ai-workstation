// app/api/tags/route.ts
// Tags API - CRUD operations with Audit Logging

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { logTagAction } from '@/lib/audit';

// GET - List all tags for user
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const documentId = searchParams.get('documentId');

        if (documentId) {
            // Get tags for a specific document
            const tags = await query(
                `SELECT t.id, t.name, t.color, t.description, t.usage_count
                 FROM tags t
                 JOIN document_tags dt ON t.id = dt.tag_id
                 WHERE dt.document_id = $1
                 ORDER BY t.name ASC`,
                [documentId]
            );

            return NextResponse.json({
                success: true,
                tags: tags.map(formatTag),
            });
        }

        // Get all tags for user
        const tags = await query(
            `SELECT id, name, color, description, usage_count, created_at
             FROM tags
             WHERE user_id = $1
             ORDER BY usage_count DESC, name ASC`,
            [userId]
        );

        return NextResponse.json({
            success: true,
            tags: tags.map(formatTag),
        });

    } catch (error: any) {
        console.error('[Tags] ❌ List error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tags', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new tag or add tag to document
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name, color, description, documentId } = body;

        if (!name || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Tag name is required' },
                { status: 400 }
            );
        }

        // Check if tag exists
        let tag = await query(
            `SELECT id FROM tags WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
            [userId, name.trim()]
        );

        let tagId: string;
        let isNewTag = false;

        if (tag.length === 0) {
            // Create new tag
            const result = await query(
                `INSERT INTO tags (user_id, name, color, description)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [userId, name.trim(), color || '#8b5cf6', description || null]
            );
            tagId = result[0].id;
            tag = result;
            isNewTag = true;
            console.log(`[Tags] ✅ Created tag: ${name}`);
        } else {
            tagId = tag[0].id;
        }

        // If documentId provided, add tag to document
        if (documentId) {
            // Verify document ownership
            const doc = await query(
                `SELECT id FROM documents WHERE id = $1 AND user_id = $2`,
                [documentId, userId]
            );

            if (doc.length === 0) {
                return NextResponse.json(
                    { error: 'Document not found' },
                    { status: 404 }
                );
            }

            // Add tag to document (ignore if already exists)
            await query(
                `INSERT INTO document_tags (document_id, tag_id)
                 VALUES ($1, $2)
                 ON CONFLICT (document_id, tag_id) DO NOTHING`,
                [documentId, tagId]
            );

            console.log(`[Tags] ✅ Added tag "${name}" to document ${documentId}`);
        }

        // Fetch full tag data
        const fullTag = await query(`SELECT * FROM tags WHERE id = $1`, [tagId]);

        // Audit log (only for new tags)
        if (isNewTag) {
            await logTagAction(userId, 'tag.create', tagId, {
                name: name.trim(),
                color: color || '#8b5cf6',
                addedToDocument: documentId || null,
            }, req);
        }

        return NextResponse.json({
            success: true,
            tag: formatTag(fullTag[0]),
            addedToDocument: !!documentId,
        });

    } catch (error: any) {
        console.error('[Tags] ❌ Create error:', error);
        return NextResponse.json(
            { error: 'Failed to create tag', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a tag
export async function PUT(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, name, color, description } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Tag ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership and get previous values
        const existing = await query(
            `SELECT id, name, color FROM tags WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Tag not found' },
                { status: 404 }
            );
        }

        // Build update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;
        const changes: Record<string, any> = {};

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name.trim());
            changes.name = name.trim();
        }
        if (color !== undefined) {
            updates.push(`color = $${paramIndex++}`);
            values.push(color);
            changes.color = color;
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
            changes.description = description;
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await query(
            `UPDATE tags SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        // Audit log
        await logTagAction(userId, 'tag.update', id, {
            previousName: existing[0].name,
            previousColor: existing[0].color,
            changes,
        }, req);

        console.log(`[Tags] ✅ Updated tag: ${id}`);

        return NextResponse.json({
            success: true,
            tag: formatTag(result[0]),
        });

    } catch (error: any) {
        console.error('[Tags] ❌ Update error:', error);
        return NextResponse.json(
            { error: 'Failed to update tag', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a tag or remove tag from document
export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const tagId = searchParams.get('id');
        const documentId = searchParams.get('documentId');

        if (!tagId) {
            return NextResponse.json(
                { error: 'Tag ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership and get tag info
        const existing = await query(
            `SELECT id, name, usage_count FROM tags WHERE id = $1 AND user_id = $2`,
            [tagId, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Tag not found' },
                { status: 404 }
            );
        }

        if (documentId) {
            // Remove tag from specific document
            await query(
                `DELETE FROM document_tags WHERE document_id = $1 AND tag_id = $2`,
                [documentId, tagId]
            );

            console.log(`[Tags] ✅ Removed tag from document: ${documentId}`);

            return NextResponse.json({
                success: true,
                message: 'Tag removed from document',
            });
        }

        const tagName = existing[0].name;
        const usageCount = existing[0].usage_count;

        // Delete the tag entirely (document_tags will cascade delete)
        await query(`DELETE FROM tags WHERE id = $1`, [tagId]);

        // Audit log
        await logTagAction(userId, 'tag.delete', tagId, {
            name: tagName,
            usageCount,
        }, req);

        console.log(`[Tags] ✅ Deleted tag: ${tagId}`);

        return NextResponse.json({
            success: true,
            message: 'Tag deleted successfully',
        });

    } catch (error: any) {
        console.error('[Tags] ❌ Delete error:', error);
        return NextResponse.json(
            { error: 'Failed to delete tag', details: error.message },
            { status: 500 }
        );
    }
}

// Helper function to format tag response
function formatTag(row: any) {
    return {
        id: row.id,
        name: row.name,
        color: row.color,
        description: row.description,
        usageCount: parseInt(row.usage_count) || 0,
        createdAt: row.created_at,
    };
}
