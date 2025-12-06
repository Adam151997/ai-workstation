// app/api/notebooks/[id]/approve/route.ts
// Human-in-the-loop approval controls

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// POST - Approve or reject a paused cell and continue execution
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
            cellId,
            action,  // 'approve' | 'reject'
            feedback  // Optional feedback from human
        } = body;

        if (!cellId || !action) {
            return NextResponse.json(
                { error: 'cellId and action are required' },
                { status: 400 }
            );
        }

        if (!['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: 'action must be "approve" or "reject"' },
                { status: 400 }
            );
        }

        // Verify notebook ownership
        const notebooks = await query(
            'SELECT * FROM notebooks WHERE id = $1 AND user_id = $2',
            [notebookId, userId]
        );

        if (notebooks.length === 0) {
            return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
        }

        // Get the cell
        const cells = await query(
            'SELECT * FROM notebook_cells WHERE id = $1 AND notebook_id = $2',
            [cellId, notebookId]
        );

        if (cells.length === 0) {
            return NextResponse.json({ error: 'Cell not found' }, { status: 404 });
        }

        const cell = cells[0];

        if (cell.status !== 'paused') {
            return NextResponse.json(
                { error: 'Cell is not in paused state' },
                { status: 400 }
            );
        }

        // Get the current run
        const runs = await query(
            `SELECT * FROM notebook_runs 
             WHERE notebook_id = $1 AND status = 'paused'
             ORDER BY started_at DESC LIMIT 1`,
            [notebookId]
        );

        if (action === 'reject') {
            // Mark cell as rejected/error
            await query(
                `UPDATE notebook_cells SET 
                    status = 'error',
                    error_message = $1,
                    execution_log = COALESCE(execution_log, '[]'::jsonb) || $2::jsonb,
                    updated_at = NOW()
                 WHERE id = $3`,
                [
                    feedback || 'Rejected by user',
                    JSON.stringify([{
                        type: 'human_review',
                        timestamp: new Date().toISOString(),
                        action: 'rejected',
                        feedback
                    }]),
                    cellId
                ]
            );

            // Update run as failed
            if (runs.length > 0) {
                await query(
                    `UPDATE notebook_runs SET 
                        status = 'failed',
                        error_cell_id = $1,
                        error_message = 'Rejected by user',
                        completed_at = NOW()
                     WHERE id = $2`,
                    [cellId, runs[0].id]
                );
            }

            // Update notebook status
            await query(
                "UPDATE notebooks SET status = 'error' WHERE id = $1",
                [notebookId]
            );

            console.log(`[Approval] ❌ Cell ${cellId} rejected by user`);

            return NextResponse.json({
                success: true,
                action: 'rejected',
                cellId,
                message: 'Cell rejected. Notebook execution stopped.'
            });
        }

        // APPROVE - Mark cell as completed and continue
        await query(
            `UPDATE notebook_cells SET 
                status = 'completed',
                execution_log = COALESCE(execution_log, '[]'::jsonb) || $1::jsonb,
                completed_at = NOW(),
                updated_at = NOW()
             WHERE id = $2`,
            [
                JSON.stringify([{
                    type: 'human_review',
                    timestamp: new Date().toISOString(),
                    action: 'approved',
                    feedback
                }]),
                cellId
            ]
        );

        console.log(`[Approval] ✅ Cell ${cellId} approved by user`);

        // Continue execution from next cell
        // Call the run endpoint with runFromCell pointing to the next cell
        const nextCellIndex = cell.cell_index + 1;
        const nextCells = await query(
            `SELECT id FROM notebook_cells 
             WHERE notebook_id = $1 AND cell_index = $2`,
            [notebookId, nextCellIndex]
        );

        if (nextCells.length > 0) {
            // Trigger continuation (could also be done client-side)
            return NextResponse.json({
                success: true,
                action: 'approved',
                cellId,
                continueFrom: nextCells[0].id,
                message: 'Cell approved. Continue execution from next cell.'
            });
        }

        // No more cells - mark as complete
        if (runs.length > 0) {
            await query(
                `UPDATE notebook_runs SET 
                    status = 'completed',
                    completed_at = NOW()
                 WHERE id = $1`,
                [runs[0].id]
            );
        }

        await query(
            "UPDATE notebooks SET status = 'completed' WHERE id = $1",
            [notebookId]
        );

        return NextResponse.json({
            success: true,
            action: 'approved',
            cellId,
            message: 'Cell approved. Notebook execution completed.'
        });

    } catch (error: any) {
        console.error('[Approval] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process approval', details: error.message },
            { status: 500 }
        );
    }
}
