// trigger/notebook-runner.ts
// Trigger.dev task for executing notebook cells sequentially
// This enables the "Execute Notebook" node in the Workflow Builder

import { task } from "@trigger.dev/sdk/v3";

interface NotebookRunnerPayload {
    notebookId: string;
    userId: string;
    variables?: Record<string, any>;
    startFromCell?: number;
    stopOnError?: boolean;
}

interface CellResult {
    cellId: string;
    cellIndex: number;
    cellType: string;
    status: 'success' | 'error' | 'skipped';
    output?: string;
    error?: string;
    executionTime: number;
}

interface NotebookRunResult {
    notebookId: string;
    notebookName: string;
    status: 'completed' | 'failed' | 'partial';
    cellsTotal: number;
    cellsCompleted: number;
    cellsFailed: number;
    cellsSkipped: number;
    results: CellResult[];
    totalExecutionTime: number;
    outputs: Record<string, any>;
    error?: string;
}

export const runNotebook = task({
    id: "run-notebook",
    maxDuration: 600, // 10 minutes max for notebook execution
    retry: {
        maxAttempts: 2,
        minTimeoutInMs: 5000,
        maxTimeoutInMs: 30000,
    },
    run: async (payload: NotebookRunnerPayload): Promise<NotebookRunResult> => {
        const { notebookId, userId, variables = {}, startFromCell = 0, stopOnError = true } = payload;
        const startTime = Date.now();
        
        console.log(`[Notebook Runner] 🚀 Starting notebook ${notebookId}`);

        // Call the API to get notebook and cells
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000';

        // Fetch notebook details
        const notebookRes = await fetch(`${baseUrl}/api/notebooks/${notebookId}`, {
            headers: {
                'x-user-id': userId,
                'x-internal-request': 'true',
            },
        });

        if (!notebookRes.ok) {
            throw new Error(`Failed to fetch notebook: ${notebookRes.statusText}`);
        }

        const notebookData = await notebookRes.json();
        const notebook = notebookData.notebook;
        const cells = notebook.cells || [];

        console.log(`[Notebook Runner] 📋 Found ${cells.length} cells in "${notebook.title}"`);

        // Update notebook status to running
        await fetch(`${baseUrl}/api/notebooks/${notebookId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
                'x-internal-request': 'true',
            },
            body: JSON.stringify({ status: 'running' }),
        });

        const results: CellResult[] = [];
        const outputs: Record<string, any> = { ...variables };
        let cellsCompleted = 0;
        let cellsFailed = 0;
        let cellsSkipped = 0;
        let overallStatus: 'completed' | 'failed' | 'partial' = 'completed';

        // Execute cells sequentially
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const cellStartTime = Date.now();

            // Skip cells before startFromCell
            if (i < startFromCell) {
                results.push({
                    cellId: cell.cell_id,
                    cellIndex: i,
                    cellType: cell.cell_type,
                    status: 'skipped',
                    executionTime: 0,
                });
                cellsSkipped++;
                continue;
            }

            console.log(`[Notebook Runner] ▶️ Executing cell ${i + 1}/${cells.length}: ${cell.cell_type}`);

            try {
                // Execute the cell via API
                const execRes = await fetch(`${baseUrl}/api/notebooks/${notebookId}/cells/${cell.cell_id}/execute`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': userId,
                        'x-internal-request': 'true',
                    },
                    body: JSON.stringify({
                        variables: outputs,
                    }),
                });

                const execData = await execRes.json();
                const executionTime = Date.now() - cellStartTime;

                if (execRes.ok && execData.success) {
                    results.push({
                        cellId: cell.cell_id,
                        cellIndex: i,
                        cellType: cell.cell_type,
                        status: 'success',
                        output: execData.output,
                        executionTime,
                    });
                    cellsCompleted++;

                    // Store output in variables for next cell
                    if (execData.output) {
                        outputs[`cell_${i}_output`] = execData.output;
                        outputs['last_output'] = execData.output;
                    }

                    console.log(`[Notebook Runner] ✅ Cell ${i + 1} completed in ${executionTime}ms`);
                } else {
                    results.push({
                        cellId: cell.cell_id,
                        cellIndex: i,
                        cellType: cell.cell_type,
                        status: 'error',
                        error: execData.error || 'Execution failed',
                        executionTime,
                    });
                    cellsFailed++;

                    console.log(`[Notebook Runner] ❌ Cell ${i + 1} failed: ${execData.error}`);

                    if (stopOnError) {
                        overallStatus = 'failed';
                        // Skip remaining cells
                        for (let j = i + 1; j < cells.length; j++) {
                            results.push({
                                cellId: cells[j].cell_id,
                                cellIndex: j,
                                cellType: cells[j].cell_type,
                                status: 'skipped',
                                executionTime: 0,
                            });
                            cellsSkipped++;
                        }
                        break;
                    } else {
                        overallStatus = 'partial';
                    }
                }
            } catch (error: any) {
                const executionTime = Date.now() - cellStartTime;
                results.push({
                    cellId: cell.cell_id,
                    cellIndex: i,
                    cellType: cell.cell_type,
                    status: 'error',
                    error: error.message,
                    executionTime,
                });
                cellsFailed++;

                console.log(`[Notebook Runner] ❌ Cell ${i + 1} exception: ${error.message}`);

                if (stopOnError) {
                    overallStatus = 'failed';
                    for (let j = i + 1; j < cells.length; j++) {
                        results.push({
                            cellId: cells[j].cell_id,
                            cellIndex: j,
                            cellType: cells[j].cell_type,
                            status: 'skipped',
                            executionTime: 0,
                        });
                        cellsSkipped++;
                    }
                    break;
                } else {
                    overallStatus = 'partial';
                }
            }
        }

        const totalExecutionTime = Date.now() - startTime;

        // Update notebook status
        const finalStatus = overallStatus === 'completed' ? 'idle' : 'failed';
        await fetch(`${baseUrl}/api/notebooks/${notebookId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
                'x-internal-request': 'true',
            },
            body: JSON.stringify({
                status: finalStatus,
                error_message: overallStatus === 'failed' 
                    ? results.find(r => r.status === 'error')?.error 
                    : null,
            }),
        });

        console.log(`[Notebook Runner] 🏁 Notebook ${overallStatus}: ${cellsCompleted}/${cells.length} cells completed in ${totalExecutionTime}ms`);

        return {
            notebookId,
            notebookName: notebook.title,
            status: overallStatus,
            cellsTotal: cells.length,
            cellsCompleted,
            cellsFailed,
            cellsSkipped,
            results,
            totalExecutionTime,
            outputs,
            error: overallStatus === 'failed' 
                ? results.find(r => r.status === 'error')?.error 
                : undefined,
        };
    },
});

// Export for workflow integration
export type { NotebookRunnerPayload, NotebookRunResult, CellResult };
