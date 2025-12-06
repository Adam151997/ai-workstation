// app/api/notebooks/[id]/route.ts
// Individual notebook operations

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// GET - Get single notebook with cells
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const notebooks = await query(
            `SELECT 
                n.*,
                COALESCE(
                    (SELECT json_agg(c ORDER BY c.cell_index) 
                     FROM notebook_cells c 
                     WHERE c.notebook_id = n.id),
                    '[]'::json
                ) as cells,
                (SELECT COUNT(*) FROM notebook_runs WHERE notebook_id = n.id) as run_count
             FROM notebooks n
             WHERE n.id = $1 
             AND (n.user_id = $2 OR $2 = ANY(n.shared_with) OR n.is_public = true)`,
            [id, userId]
        );

        if (notebooks.length === 0) {
            return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
        }

        return NextResponse.json({ notebook: notebooks[0] });

    } catch (error: any) {
        console.error('[Notebooks] GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notebook', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update notebook
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
        const { title, description, icon, projectId, tags, sharedWith, isPublic } = body;

        // Verify ownership
        const existing = await query(
            'SELECT * FROM notebooks WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Notebook not found or not owned' }, { status: 404 });
        }

        const result = await query(
            `UPDATE notebooks SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                icon = COALESCE($3, icon),
                project_id = COALESCE($4, project_id),
                tags = COALESCE($5, tags),
                shared_with = COALESCE($6, shared_with),
                is_public = COALESCE($7, is_public),
                updated_at = NOW()
             WHERE id = $8 AND user_id = $9
             RETURNING *`,
            [title, description, icon, projectId, tags, sharedWith, isPublic, id, userId]
        );

        return NextResponse.json({ 
            success: true,
            notebook: result[0] 
        });

    } catch (error: any) {
        console.error('[Notebooks] PUT error:', error);
        return NextResponse.json(
            { error: 'Failed to update notebook', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete notebook
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

        // Cells are deleted via CASCADE
        const result = await query(
            'DELETE FROM notebooks WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, userId]
        );

        if (result.length === 0) {
            return NextResponse.json({ error: 'Notebook not found or not owned' }, { status: 404 });
        }

        console.log(`[Notebooks] 🗑️ Deleted notebook: ${id}`);

        return NextResponse.json({ 
            success: true,
            deletedId: id 
        });

    } catch (error: any) {
        console.error('[Notebooks] DELETE error:', error);
        return NextResponse.json(
            { error: 'Failed to delete notebook', details: error.message },
            { status: 500 }
        );
    }
}
