// components/notebooks/NotebookCell.tsx
'use client';

import { useState } from 'react';
import { 
    Play, Pause, Trash2, GripVertical, ChevronDown, ChevronRight,
    CheckCircle, XCircle, Clock, AlertCircle, Loader2, Edit2, Link2
} from 'lucide-react';
import { NotebookCell as CellType, CELL_TYPE_CONFIG, CELL_STATUS_CONFIG } from '@/config/notebooks';

interface NotebookCellProps {
    cell: CellType;
    isRunning: boolean;
    onUpdate: (cellId: string, updates: Partial<CellType>) => void;
    onDelete: (cellId: string) => void;
    onRunCell: (cellId: string) => void;
    onAddDependency: (cellId: string, dependencyId: string) => void;
    availableCells: Array<{ id: string; title: string; cell_index: number }>;
    dragHandleProps?: any;
}

export function NotebookCell({
    cell,
    isRunning,
    onUpdate,
    onDelete,
    onRunCell,
    onAddDependency,
    availableCells,
    dragHandleProps
}: NotebookCellProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(cell.content);
    const [showDependencies, setShowDependencies] = useState(false);

    const cellConfig = CELL_TYPE_CONFIG[cell.cell_type];
    const statusConfig = CELL_STATUS_CONFIG[cell.status];

    const handleSave = () => {
        onUpdate(cell.id, { content: editContent });
        setIsEditing(false);
    };

    const getStatusIcon = () => {
        switch (cell.status) {
            case 'running':
                return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'paused':
                return <Pause className="w-4 h-4 text-orange-500" />;
            case 'queued':
                return <Clock className="w-4 h-4 text-blue-500" />;
            default:
                return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
        }
    };

    return (
        <div className={`
            border rounded-lg bg-white shadow-sm
            ${cell.status === 'running' ? 'border-yellow-400 ring-2 ring-yellow-100' : ''}
            ${cell.status === 'completed' ? 'border-green-200' : ''}
            ${cell.status === 'error' ? 'border-red-200' : ''}
        `}>
            {/* Cell Header */}
            <div className="flex items-center gap-2 p-3 border-b bg-gray-50 rounded-t-lg">
                {/* Drag Handle */}
                <div {...dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600">
                    <GripVertical className="w-4 h-4" />
                </div>

                {/* Cell Type Icon */}
                <span className="text-lg" title={cellConfig.label}>
                    {cellConfig.icon}
                </span>

                {/* Cell Title/Index */}
                <div className="flex-1">
                    <input
                        type="text"
                        value={cell.title || `Cell ${cell.cell_index + 1}`}
                        onChange={(e) => onUpdate(cell.id, { title: e.target.value })}
                        className="bg-transparent font-medium text-gray-900 border-none focus:outline-none focus:ring-0 w-full"
                        placeholder={`Cell ${cell.cell_index + 1}`}
                    />
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <span className="text-xs text-gray-500">{statusConfig.label}</span>
                </div>

                {/* Duration */}
                {cell.duration_ms && (
                    <span className="text-xs text-gray-400">
                        {cell.duration_ms < 1000 
                            ? `${cell.duration_ms}ms` 
                            : `${(cell.duration_ms / 1000).toFixed(1)}s`
                        }
                    </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onRunCell(cell.id)}
                        disabled={isRunning || cell.cell_type === 'note'}
                        className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50"
                        title="Run cell"
                    >
                        <Play className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                        onClick={() => setShowDependencies(!showDependencies)}
                        className="p-1.5 rounded hover:bg-gray-200"
                        title="Dependencies"
                    >
                        <Link2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 rounded hover:bg-gray-200"
                    >
                        {isExpanded 
                            ? <ChevronDown className="w-4 h-4 text-gray-500" />
                            : <ChevronRight className="w-4 h-4 text-gray-500" />
                        }
                    </button>
                    <button
                        onClick={() => onDelete(cell.id)}
                        className="p-1.5 rounded hover:bg-red-100"
                        title="Delete cell"
                    >
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                </div>
            </div>

            {/* Dependencies Panel */}
            {showDependencies && (
                <div className="p-3 bg-gray-50 border-b">
                    <p className="text-xs text-gray-500 mb-2">Dependencies (runs after these cells complete):</p>
                    <div className="flex flex-wrap gap-2">
                        {availableCells
                            .filter(c => c.cell_index < cell.cell_index)
                            .map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => onAddDependency(cell.id, c.id)}
                                    className={`
                                        px-2 py-1 text-xs rounded border
                                        ${cell.dependencies.includes(c.id)
                                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                                            : 'bg-white border-gray-300 text-gray-600 hover:border-blue-300'
                                        }
                                    `}
                                >
                                    {c.title || `Cell ${c.cell_index + 1}`}
                                </button>
                            ))
                        }
                        {availableCells.filter(c => c.cell_index < cell.cell_index).length === 0 && (
                            <span className="text-xs text-gray-400">No previous cells available</span>
                        )}
                    </div>
                </div>
            )}

            {/* Cell Content */}
            {isExpanded && (
                <div className="p-4">
                    {/* Input Area */}
                    <div className="mb-4">
                        {isEditing ? (
                            <div className="space-y-2">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full p-3 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={4}
                                    placeholder="Enter your command..."
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSave}
                                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditContent(cell.content);
                                            setIsEditing(false);
                                        }}
                                        className="px-3 py-1.5 text-gray-600 text-sm rounded hover:bg-gray-100"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => setIsEditing(true)}
                                className="p-3 bg-gray-50 rounded-lg cursor-text hover:bg-gray-100 transition-colors"
                            >
                                <p className="text-gray-800 whitespace-pre-wrap">
                                    {cell.content || <span className="text-gray-400 italic">Click to add content...</span>}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Output Area */}
                    {cell.output && (
                        <div className="border-t pt-4">
                            <p className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                                <span>Output</span>
                                {cell.output_type && (
                                    <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                                        {cell.output_type}
                                    </span>
                                )}
                            </p>
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                {typeof cell.output === 'string' ? (
                                    <p className="text-gray-800 whitespace-pre-wrap">{cell.output}</p>
                                ) : (
                                    <pre className="text-sm overflow-x-auto">
                                        {JSON.stringify(cell.output, null, 2)}
                                    </pre>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {cell.error_message && (
                        <div className="border-t pt-4">
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                                    <p className="text-red-700 text-sm">{cell.error_message}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reasoning (Glass Cockpit) */}
                    {cell.reasoning && (
                        <div className="mt-3 text-xs text-gray-500">
                            <details>
                                <summary className="cursor-pointer hover:text-gray-700">
                                    View reasoning
                                </summary>
                                <p className="mt-1 p-2 bg-gray-50 rounded">{cell.reasoning}</p>
                            </details>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
