// app/api/notebooks/[id]/run/route.ts
// Execute notebook cells - The Glass Cockpit Engine

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { streamText, generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { openai } from '@ai-sdk/openai';

interface Cell {
    id: string;
    notebook_id: string;
    user_id: string;
    cell_index: number;
    cell_type: string;
    title: string;
    content: string;
    dependencies: string[];
    agent_preference: string;
    timeout_ms: number;
    retry_on_error: boolean;
    status: string;
    output: any;
}

interface ExecutionContext {
    userId: string;
    notebookId: string;
    runId: string;
    cellOutputs: Record<string, any>;  // cell_id -> output
}

// POST - Run notebook (all cells or specific cell)
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
            cellId,           // Optional: run specific cell only
            runFromCell,      // Optional: run from this cell onwards
            includeApproved = false  // Re-run approved cells
        } = body;

        // Verify notebook ownership
        const notebooks = await query(
            'SELECT * FROM notebooks WHERE id = $1 AND user_id = $2',
            [notebookId, userId]
        );

        if (notebooks.length === 0) {
            return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
        }

        // Get cells to execute
        let cellsQuery = `
            SELECT * FROM notebook_cells 
            WHERE notebook_id = $1 
            ORDER BY cell_index
        `;
        const cells: Cell[] = await query(cellsQuery, [notebookId]);

        if (cells.length === 0) {
            return NextResponse.json({ error: 'Notebook has no cells' }, { status: 400 });
        }

        // Determine which cells to run
        let cellsToRun = cells;
        
        if (cellId) {
            // Run single cell
            cellsToRun = cells.filter(c => c.id === cellId);
        } else if (runFromCell) {
            // Run from specific cell onwards
            const startIndex = cells.findIndex(c => c.id === runFromCell);
            if (startIndex >= 0) {
                cellsToRun = cells.slice(startIndex);
            }
        }

        // Create run record
        const runCount = await query(
            'SELECT COALESCE(MAX(run_number), 0) + 1 as next_run FROM notebook_runs WHERE notebook_id = $1',
            [notebookId]
        );

        const runResult = await query(
            `INSERT INTO notebook_runs (notebook_id, user_id, run_number, cells_total, status)
             VALUES ($1, $2, $3, $4, 'running')
             RETURNING *`,
            [notebookId, userId, runCount[0].next_run, cellsToRun.length]
        );
        const run = runResult[0];

        // Update notebook status
        await query(
            "UPDATE notebooks SET status = 'running', last_run_at = NOW() WHERE id = $1",
            [notebookId]
        );

        // Execute cells
        const context: ExecutionContext = {
            userId,
            notebookId,
            runId: run.id,
            cellOutputs: {}
        };

        // Pre-populate context with existing completed cell outputs
        for (const cell of cells) {
            if (cell.status === 'completed' && cell.output) {
                context.cellOutputs[cell.id] = cell.output;
            }
        }

        const startTime = Date.now();
        let cellsCompleted = 0;
        let cellsFailed = 0;
        let cellsSkipped = 0;
        let totalTokens = 0;
        let totalCost = 0;

        // Process cells in order, respecting dependencies
        for (const cell of cellsToRun) {
            // Check dependencies
            const dependenciesMet = await checkDependencies(cell, context, cells);
            
            if (!dependenciesMet) {
                await updateCellStatus(cell.id, 'skipped', null, 'Dependencies not met');
                cellsSkipped++;
                continue;
            }

            // Handle approve cells - pause for human
            if (cell.cell_type === 'approve' && !includeApproved) {
                await updateCellStatus(cell.id, 'paused', null, 'Awaiting approval');
                
                // Update run status to paused
                await query(
                    `UPDATE notebook_runs SET 
                        status = 'paused',
                        cells_completed = $1,
                        cells_failed = $2,
                        cells_skipped = $3
                     WHERE id = $4`,
                    [cellsCompleted, cellsFailed, cellsSkipped, run.id]
                );

                return NextResponse.json({
                    status: 'paused',
                    runId: run.id,
                    pausedAt: cell.id,
                    cellsCompleted,
                    message: `Paused at approval cell: ${cell.title || cell.content.substring(0, 50)}`
                });
            }

            // Execute cell
            try {
                await updateCellStatus(cell.id, 'running');
                
                const result = await executeCell(cell, context);
                
                context.cellOutputs[cell.id] = result.output;
                totalTokens += result.tokens || 0;
                totalCost += result.cost || 0;
                
                await updateCellResult(cell.id, result);
                cellsCompleted++;

            } catch (error: any) {
                await updateCellStatus(cell.id, 'error', null, error.message);
                cellsFailed++;

                // Stop on error (unless retry configured)
                if (!cell.retry_on_error) {
                    await query(
                        `UPDATE notebook_runs SET 
                            status = 'failed',
                            cells_completed = $1,
                            cells_failed = $2,
                            cells_skipped = $3,
                            error_cell_id = $4,
                            error_message = $5,
                            completed_at = NOW(),
                            duration_ms = $6
                         WHERE id = $7`,
                        [cellsCompleted, cellsFailed, cellsSkipped, cell.id, error.message, Date.now() - startTime, run.id]
                    );

                    await query("UPDATE notebooks SET status = 'error' WHERE id = $1", [notebookId]);

                    return NextResponse.json({
                        status: 'failed',
                        runId: run.id,
                        failedAt: cell.id,
                        error: error.message,
                        cellsCompleted,
                        cellsFailed
                    });
                }
            }
        }

        const durationMs = Date.now() - startTime;

        // Update run as complete
        await query(
            `UPDATE notebook_runs SET 
                status = 'completed',
                cells_completed = $1,
                cells_failed = $2,
                cells_skipped = $3,
                total_tokens = $4,
                total_cost = $5,
                duration_ms = $6,
                completed_at = NOW()
             WHERE id = $7`,
            [cellsCompleted, cellsFailed, cellsSkipped, totalTokens, totalCost, durationMs, run.id]
        );

        await query(
            "UPDATE notebooks SET status = 'completed', last_run_duration_ms = $1 WHERE id = $2",
            [durationMs, notebookId]
        );

        console.log(`[Notebook] ✅ Run ${run.id} completed in ${durationMs}ms`);

        return NextResponse.json({
            status: 'completed',
            runId: run.id,
            cellsCompleted,
            cellsFailed,
            cellsSkipped,
            totalTokens,
            totalCost,
            durationMs,
            outputs: context.cellOutputs
        });

    } catch (error: any) {
        console.error('[Notebook Run] Error:', error);
        return NextResponse.json(
            { error: 'Failed to run notebook', details: error.message },
            { status: 500 }
        );
    }
}

// Check if cell dependencies are met
async function checkDependencies(cell: Cell, context: ExecutionContext, allCells: Cell[]): Promise<boolean> {
    if (!cell.dependencies || cell.dependencies.length === 0) {
        return true;
    }

    for (const depId of cell.dependencies) {
        const depCell = allCells.find(c => c.id === depId);
        if (!depCell) continue;

        // Check if dependency has output
        if (!context.cellOutputs[depId]) {
            // Check database for completed status
            const result = await query(
                "SELECT status, output FROM notebook_cells WHERE id = $1",
                [depId]
            );
            if (result.length === 0 || result[0].status !== 'completed') {
                return false;
            }
            context.cellOutputs[depId] = result[0].output;
        }
    }

    return true;
}

// Execute a single cell
async function executeCell(cell: Cell, context: ExecutionContext): Promise<{
    output: any;
    outputType: string;
    reasoning: string;
    tokens: number;
    cost: number;
    toolsUsed: string[];
}> {
    const startTime = Date.now();

    // Inject dependency outputs into content
    let enhancedContent = cell.content;
    for (const [cellId, output] of Object.entries(context.cellOutputs)) {
        // Replace {{cell_id}} or {{prev}} patterns
        const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
        enhancedContent = enhancedContent.replace(
            new RegExp(`\\{\\{${cellId}\\}\\}`, 'g'),
            outputStr
        );
    }
    // Replace {{prev}} with last cell's output
    const outputKeys = Object.keys(context.cellOutputs);
    if (outputKeys.length > 0) {
        const lastOutput = context.cellOutputs[outputKeys[outputKeys.length - 1]];
        enhancedContent = enhancedContent.replace(
            /\{\{prev\}\}/g,
            typeof lastOutput === 'string' ? lastOutput : JSON.stringify(lastOutput)
        );
    }

    // Build system prompt based on cell type
    const systemPrompt = getSystemPromptForCellType(cell.cell_type, context);

    // Execute with AI
    const response = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        system: systemPrompt,
        prompt: enhancedContent,
    });

    const durationMs = Date.now() - startTime;

    // Parse output based on cell type
    let output: any = response.text;
    let outputType = 'text';

    // Try to parse JSON for data-oriented cells
    if (cell.cell_type === 'query' || cell.cell_type === 'transform') {
        try {
            // Look for JSON in response
            const jsonMatch = response.text.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
                output = JSON.parse(jsonMatch[1]);
                outputType = 'json';
            } else if (response.text.trim().startsWith('{') || response.text.trim().startsWith('[')) {
                output = JSON.parse(response.text);
                outputType = 'json';
            }
        } catch {
            // Keep as text
        }
    }

    // Estimate tokens (rough)
    const tokens = Math.ceil((enhancedContent.length + response.text.length) / 4);
    const cost = tokens * 0.000001; // Rough estimate

    return {
        output,
        outputType,
        reasoning: `Processed ${cell.cell_type} cell with ${enhancedContent.length} chars input`,
        tokens,
        cost,
        toolsUsed: [] // TODO: Track actual tools used
    };
}

function getSystemPromptForCellType(cellType: string, context: ExecutionContext): string {
    const basePrompt = `You are an AI assistant helping with a business workflow. 
You have access to previous cell outputs which may be referenced in the user's request.
Be concise and actionable in your responses.`;

    switch (cellType) {
        case 'command':
            return `${basePrompt}
Execute the user's command and provide clear results.
If the command requires external data you don't have, explain what would be needed.`;

        case 'query':
            return `${basePrompt}
Retrieve and structure the requested data.
Format data as JSON when possible (wrap in \`\`\`json blocks).
Include relevant metadata about the query results.`;

        case 'transform':
            return `${basePrompt}
Transform the input data as requested.
Preserve data structure unless explicitly asked to change it.
Output the transformed data as JSON (wrap in \`\`\`json blocks).`;

        case 'visualize':
            return `${basePrompt}
Create a visualization description or structured data for charts.
For charts, output JSON with: { chartType, labels, datasets, options }
For tables, output JSON with: { columns, rows }
For documents, provide structured markdown.`;

        case 'note':
            return `${basePrompt}
This is a note cell. Simply acknowledge the note content.`;

        case 'condition':
            return `${basePrompt}
Evaluate the condition and respond with exactly "true" or "false".
Explain your reasoning briefly after the boolean result.`;

        default:
            return basePrompt;
    }
}

async function updateCellStatus(cellId: string, status: string, output?: any, errorMessage?: string) {
    await query(
        `UPDATE notebook_cells SET 
            status = $1,
            ${status === 'running' ? 'started_at = NOW(),' : ''}
            ${status === 'completed' ? 'completed_at = NOW(),' : ''}
            ${errorMessage ? 'error_message = $3,' : ''}
            updated_at = NOW()
         WHERE id = $2`,
        errorMessage ? [status, cellId, errorMessage] : [status, cellId]
    );
}

async function updateCellResult(cellId: string, result: any) {
    await query(
        `UPDATE notebook_cells SET 
            status = 'completed',
            output = $1,
            output_type = $2,
            reasoning = $3,
            tokens_input = $4,
            tokens_output = $4,
            cost = $5,
            tools_used = $6,
            completed_at = NOW(),
            updated_at = NOW()
         WHERE id = $7`,
        [
            JSON.stringify(result.output),
            result.outputType,
            result.reasoning,
            result.tokens,
            result.cost,
            result.toolsUsed,
            cellId
        ]
    );
}
