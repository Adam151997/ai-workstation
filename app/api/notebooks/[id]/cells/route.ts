// app/api/notebooks/[id]/cells/route.ts
// Cell management within a notebook

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// POST - Add a new cell to notebook
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: notebookId } = await params;
        const body = await req.json();
        const { 
            cellType = 'command',
            title,
            content,
            dependencies = [],
            agentPreference,
            insertAt  // Optional: insert at specific index
        } = body;

        // Verify notebook ownership
        const notebooks = await query(
            'SELECT * FROM notebooks WHERE id = $1 AND user_id = $2',
            [notebookId, userId]
        );

        if (notebooks.length === 0) {
            return NextResponse.json({ error: 'Notebook not found or not owned' }, { status: 404 });
        }

        // Get current max cell index
        const maxIndex = await query(
            'SELECT COALESCE(MAX(cell_index), -1) as max_index FROM notebook_cells WHERE notebook_id = $1',
            [notebookId]
        );

        let cellIndex = (maxIndex[0]?.max_index ?? -1) + 1;

        // If inserting at specific position, shift existing cells
        if (insertAt !== undefined && insertAt < cellIndex) {
            await query(
                `UPDATE notebook_cells 
                 SET cell_index = cell_index + 1 
                 WHERE notebook_id = $1 AND cell_index >= $2`,
                [notebookId, insertAt]
            );
            cellIndex = insertAt;
        }

        const result = await query(
            `INSERT INTO notebook_cells 
             (notebook_id, user_id, cell_index, cell_type, title, content, dependencies, agent_preference)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [notebookId, userId, cellIndex, cellType, title, content, dependencies, agentPreference]
        );

        console.log(`[Cells] ✅ Added cell to notebook ${notebookId}`);

        return NextResponse.json({ 
            success: true,
            cell: result[0] 
        });

    } catch (error: any) {
        console.error('[Cells] POST error:', error);
        return NextResponse.json(
            { error: 'Failed to add cell', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - Reorder cells
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: notebookId } = await params;
        const body = await req.json();
        const { cellOrder } = body; // Array of cell IDs in new order

        // Verify notebook ownership
        const notebooks = await query(
            'SELECT * FROM notebooks WHERE id = $1 AND user_id = $2',
            [notebookId, userId]
        );

        if (notebooks.length === 0) {
            return NextResponse.json({ error: 'Notebook not found or not owned' }, { status: 404 });
        }

        // Update cell indices based on new order
        for (let i = 0; i < cellOrder.length; i++) {
            await query(
                'UPDATE notebook_cells SET cell_index = $1, updated_at = NOW() WHERE id = $2 AND notebook_id = $3',
                [i, cellOrder[i], notebookId]
            );
        }

        // Fetch updated cells
        const cells = await query(
            'SELECT * FROM notebook_cells WHERE notebook_id = $1 ORDER BY cell_index',
            [notebookId]
        );

        console.log(`[Cells] ✅ Reordered ${cellOrder.length} cells`);

        return NextResponse.json({ 
            success: true,
            cells 
        });

    } catch (error: any) {
        console.error('[Cells] PUT error:', error);
        return NextResponse.json(
            { error: 'Failed to reorder cells', details: error.message },
            { status: 500 }
        );
    }
}
