// components/notebooks/NotebookEditor.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
    Play, Plus, Loader2, Clock, CheckCircle, AlertTriangle, 
    RotateCcw, Pause, Square, RefreshCw
} from 'lucide-react';
import { NotebookCell } from './NotebookCell';
import { 
    Notebook, NotebookCell as CellType, CellType as CellTypeEnum,
    CELL_TYPE_CONFIG 
} from '@/config/notebooks';

interface NotebookEditorProps {
    notebookId: string;
}

export function NotebookEditor({ notebookId }: NotebookEditorProps) {
    const [notebook, setNotebook] = useState<Notebook | null>(null);
    const [cells, setCells] = useState<CellType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [runStatus, setRunStatus] = useState<{
        status: string;
        cellsCompleted: number;
        cellsFailed: number;
        currentCell?: string;
        pausedAt?: string;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch notebook data
    const fetchNotebook = useCallback(async () => {
        try {
            const response = await fetch(`/api/notebooks/${notebookId}`);
            if (!response.ok) throw new Error('Failed to fetch notebook');
            
            const data = await response.json();
            setNotebook(data.notebook);
            setCells(data.notebook.cells || []);

            // Check if notebook is paused
            if (data.notebook.status === 'paused') {
                setIsPaused(true);
                setRunStatus(prev => prev ? { ...prev, status: 'paused' } : { status: 'paused', cellsCompleted: 0, cellsFailed: 0 });
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [notebookId]);

    useEffect(() => {
        fetchNotebook();
    }, [fetchNotebook]);

    // Update notebook title
    const updateTitle = async (title: string) => {
        try {
            await fetch(`/api/notebooks/${notebookId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            });
            setNotebook(prev => prev ? { ...prev, title } : null);
        } catch (err) {
            console.error('Failed to update title:', err);
        }
    };

    // Add new cell
    const addCell = async (cellType: CellTypeEnum = 'command', insertAt?: number) => {
        try {
            const response = await fetch(`/api/notebooks/${notebookId}/cells`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cellType,
                    content: '',
                    insertAt,
                }),
            });

            if (!response.ok) throw new Error('Failed to add cell');
            
            const data = await response.json();
            
            // Insert at correct position
            if (insertAt !== undefined) {
                setCells(prev => [
                    ...prev.slice(0, insertAt),
                    data.cell,
                    ...prev.slice(insertAt).map(c => ({ ...c, cell_index: c.cell_index + 1 }))
                ]);
            } else {
                setCells(prev => [...prev, data.cell]);
            }
        } catch (err) {
            console.error('Failed to add cell:', err);
        }
    };

    // Update cell
    const updateCell = async (cellId: string, updates: Partial<CellType>) => {
        try {
            await fetch(`/api/notebooks/${notebookId}/cells/${cellId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            setCells(prev => prev.map(c => 
                c.id === cellId ? { ...c, ...updates } : c
            ));
        } catch (err) {
            console.error('Failed to update cell:', err);
        }
    };

    // Delete cell
    const deleteCell = async (cellId: string) => {
        try {
            await fetch(`/api/notebooks/${notebookId}/cells/${cellId}`, {
                method: 'DELETE',
            });

            setCells(prev => prev.filter(c => c.id !== cellId));
        } catch (err) {
            console.error('Failed to delete cell:', err);
        }
    };

    // Toggle dependency
    const toggleDependency = async (cellId: string, dependencyId: string) => {
        const cell = cells.find(c => c.id === cellId);
        if (!cell) return;

        const newDeps = cell.dependencies.includes(dependencyId)
            ? cell.dependencies.filter(d => d !== dependencyId)
            : [...cell.dependencies, dependencyId];

        await updateCell(cellId, { dependencies: newDeps });
    };

    // Run entire notebook
    const runNotebook = async () => {
        setIsRunning(true);
        setIsPaused(false);
        setRunStatus({ status: 'running', cellsCompleted: 0, cellsFailed: 0 });

        // Reset all cell statuses
        setCells(prev => prev.map(c => ({ ...c, status: 'queued' as const })));

        try {
            const response = await fetch(`/api/notebooks/${notebookId}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            const data = await response.json();

            setRunStatus({
                status: data.status,
                cellsCompleted: data.cellsCompleted || 0,
                cellsFailed: data.cellsFailed || 0,
                pausedAt: data.pausedAt,
            });

            if (data.status === 'paused') {
                setIsPaused(true);
            }

            // Refresh notebook to get updated cell outputs
            await fetchNotebook();

        } catch (err: any) {
            setRunStatus({
                status: 'error',
                cellsCompleted: 0,
                cellsFailed: 1,
            });
            setError(err.message);
        } finally {
            setIsRunning(false);
        }
    };

    // Run single cell
    const runCell = async (cellId: string) => {
        setIsRunning(true);
        
        // Update cell status
        setCells(prev => prev.map(c => 
            c.id === cellId ? { ...c, status: 'running' as const } : c
        ));

        try {
            const response = await fetch(`/api/notebooks/${notebookId}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cellId }),
            });

            const data = await response.json();
            
            // Refresh to get updated output
            await fetchNotebook();

        } catch (err: any) {
            setCells(prev => prev.map(c => 
                c.id === cellId ? { ...c, status: 'error' as const, error_message: err.message } : c
            ));
        } finally {
            setIsRunning(false);
        }
    };

    // Approve cell and continue
    const approveCell = async (cellId: string) => {
        try {
            const response = await fetch(`/api/notebooks/${notebookId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cellId, action: 'approve' }),
            });

            const data = await response.json();

            if (data.continueFrom) {
                // Continue execution from next cell
                setIsRunning(true);
                setIsPaused(false);

                const continueResponse = await fetch(`/api/notebooks/${notebookId}/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ runFromCell: data.continueFrom, includeApproved: true }),
                });

                const continueData = await continueResponse.json();

                setRunStatus({
                    status: continueData.status,
                    cellsCompleted: continueData.cellsCompleted || 0,
                    cellsFailed: continueData.cellsFailed || 0,
                    pausedAt: continueData.pausedAt,
                });

                if (continueData.status === 'paused') {
                    setIsPaused(true);
                }

                setIsRunning(false);
            }

            await fetchNotebook();

        } catch (err: any) {
            console.error('Failed to approve cell:', err);
            setError(err.message);
        }
    };

    // Reject cell
    const rejectCell = async (cellId: string) => {
        try {
            await fetch(`/api/notebooks/${notebookId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cellId, action: 'reject' }),
            });

            setIsPaused(false);
            setRunStatus(prev => prev ? { ...prev, status: 'failed' } : null);

            await fetchNotebook();

        } catch (err: any) {
            console.error('Failed to reject cell:', err);
            setError(err.message);
        }
    };

    // Cancel running notebook
    const cancelNotebook = async () => {
        // For now, just refresh and stop local running state
        setIsRunning(false);
        setIsPaused(false);
        setRunStatus(prev => prev ? { ...prev, status: 'cancelled' } : null);
        await fetchNotebook();
    };

    // Reset all cells
    const resetCells = async () => {
        // Reset local state
        setCells(prev => prev.map(c => ({
            ...c,
            status: 'idle' as const,
            output: null,
            error_message: undefined,
            reasoning: undefined,
            execution_log: [],
        })));
        setRunStatus(null);
        setIsPaused(false);

        // Reset in database
        for (const cell of cells) {
            await fetch(`/api/notebooks/${notebookId}/cells/${cell.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status: 'idle',
                    output: null,
                    error_message: null,
                    reasoning: null,
                    execution_log: null,
                }),
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                {error}
                <button 
                    onClick={() => { setError(null); fetchNotebook(); }}
                    className="ml-4 underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-4 p-4 border-b bg-white">
                {/* Title */}
                <div className="flex-1">
                    <input
                        type="text"
                        value={notebook?.title || ''}
                        onChange={(e) => updateTitle(e.target.value)}
                        className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                        placeholder="Untitled Notebook"
                    />
                    <p className="text-sm text-gray-500">
                        {cells.length} cells • Last run: {notebook?.last_run_at 
                            ? new Date(notebook.last_run_at).toLocaleString()
                            : 'Never'
                        }
                    </p>
                </div>

                {/* Run Status */}
                {runStatus && (
                    <div className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                        ${runStatus.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                        ${runStatus.status === 'running' ? 'bg-yellow-100 text-yellow-700' : ''}
                        ${runStatus.status === 'error' || runStatus.status === 'failed' ? 'bg-red-100 text-red-700' : ''}
                        ${runStatus.status === 'paused' ? 'bg-orange-100 text-orange-700' : ''}
                        ${runStatus.status === 'cancelled' ? 'bg-gray-100 text-gray-700' : ''}
                    `}>
                        {runStatus.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                        {runStatus.status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                        {runStatus.status === 'paused' && <Pause className="w-4 h-4" />}
                        {(runStatus.status === 'error' || runStatus.status === 'failed') && <AlertTriangle className="w-4 h-4" />}
                        <span>
                            {runStatus.status === 'paused' ? 'Awaiting approval' : 
                             runStatus.status === 'cancelled' ? 'Cancelled' :
                             `${runStatus.cellsCompleted}/${cells.length} completed`}
                            {runStatus.cellsFailed > 0 && ` • ${runStatus.cellsFailed} failed`}
                        </span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetCells}
                        disabled={isRunning}
                        className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
                        title="Reset all cells"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </button>

                    <button
                        onClick={fetchNotebook}
                        className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>

                    {isRunning ? (
                        <button
                            onClick={cancelNotebook}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                        >
                            <Square className="w-4 h-4" />
                            Cancel
                        </button>
                    ) : (
                        <button
                            onClick={runNotebook}
                            disabled={cells.length === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Play className="w-4 h-4" />
                            Run All
                        </button>
                    )}
                </div>
            </div>

            {/* Paused Banner */}
            {isPaused && (
                <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-3">
                    <Pause className="w-5 h-5 text-orange-600" />
                    <span className="text-orange-800 font-medium">
                        Notebook paused - Human approval required
                    </span>
                    <span className="text-orange-600 text-sm">
                        Review the outputs below and approve or reject to continue
                    </span>
                </div>
            )}

            {/* Cells */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {cells.map((cell, index) => (
                    <div key={cell.id}>
                        <NotebookCell
                            cell={cell}
                            isRunning={isRunning}
                            onUpdate={updateCell}
                            onDelete={deleteCell}
                            onRunCell={runCell}
                            onAddDependency={toggleDependency}
                            onApprove={approveCell}
                            onReject={rejectCell}
                            availableCells={cells.map(c => ({
                                id: c.id,
                                title: c.title || `Cell ${c.cell_index + 1}`,
                                cell_index: c.cell_index,
                            }))}
                        />

                        {/* Add cell button between cells */}
                        <div className="flex justify-center my-2">
                            <button
                                onClick={() => addCell('command', index + 1)}
                                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 opacity-0 hover:opacity-100 transition-opacity"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add first cell or add at end */}
                {cells.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <p className="mb-4">No cells yet. Add your first cell to get started.</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {Object.entries(CELL_TYPE_CONFIG).map(([type, config]) => (
                                <button
                                    key={type}
                                    onClick={() => addCell(type as CellTypeEnum)}
                                    className="px-3 py-2 border rounded-lg hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <span>{config.icon}</span>
                                    <span>{config.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <button
                            onClick={() => addCell('command')}
                            className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Cell
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
