// app/api/notebooks/[id]/cells/[cellId]/route.ts
// Individual cell operations

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// PUT - Update a cell
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; cellId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: notebookId, cellId } = await params;
        const body = await req.json();
        const { 
            cellType,
            title,
            content,
            dependencies,
            agentPreference,
            timeoutMs,
            retryOnError,
            maxRetries
        } = body;

        // Verify ownership
        const existing = await query(
            `SELECT c.* FROM notebook_cells c
             JOIN notebooks n ON c.notebook_id = n.id
             WHERE c.id = $1 AND n.id = $2 AND n.user_id = $3`,
            [cellId, notebookId, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Cell not found' }, { status: 404 });
        }

        const result = await query(
            `UPDATE notebook_cells SET
                cell_type = COALESCE($1, cell_type),
                title = COALESCE($2, title),
                content = COALESCE($3, content),
                dependencies = COALESCE($4, dependencies),
                agent_preference = COALESCE($5, agent_preference),
                timeout_ms = COALESCE($6, timeout_ms),
                retry_on_error = COALESCE($7, retry_on_error),
                max_retries = COALESCE($8, max_retries),
                updated_at = NOW()
             WHERE id = $9
             RETURNING *`,
            [cellType, title, content, dependencies, agentPreference, timeoutMs, retryOnError, maxRetries, cellId]
        );

        return NextResponse.json({ 
            success: true,
            cell: result[0] 
        });

    } catch (error: any) {
        console.error('[Cells] PUT error:', error);
        return NextResponse.json(
            { error: 'Failed to update cell', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a cell
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; cellId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: notebookId, cellId } = await params;

        // Verify ownership
        const existing = await query(
            `SELECT c.cell_index FROM notebook_cells c
             JOIN notebooks n ON c.notebook_id = n.id
             WHERE c.id = $1 AND n.id = $2 AND n.user_id = $3`,
            [cellId, notebookId, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Cell not found' }, { status: 404 });
        }

        const deletedIndex = existing[0].cell_index;

        // Delete the cell
        await query('DELETE FROM notebook_cells WHERE id = $1', [cellId]);

        // Reindex remaining cells
        await query(
            `UPDATE notebook_cells 
             SET cell_index = cell_index - 1 
             WHERE notebook_id = $1 AND cell_index > $2`,
            [notebookId, deletedIndex]
        );

        // Remove from other cells' dependencies
        await query(
            `UPDATE notebook_cells 
             SET dependencies = array_remove(dependencies, $1::uuid)
             WHERE notebook_id = $2`,
            [cellId, notebookId]
        );

        console.log(`[Cells] 🗑️ Deleted cell: ${cellId}`);

        return NextResponse.json({ 
            success: true,
            deletedId: cellId 
        });

    } catch (error: any) {
        console.error('[Cells] DELETE error:', error);
        return NextResponse.json(
            { error: 'Failed to delete cell', details: error.message },
            { status: 500 }
        );
    }
}
