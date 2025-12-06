// components/notebooks/NotebookCell.tsx
'use client';

import { useState } from 'react';
import { 
    Play, Pause, Trash2, GripVertical, ChevronDown, ChevronRight,
    CheckCircle, XCircle, Clock, AlertCircle, Loader2, Link2,
    Eye, Shield, ThumbsUp, ThumbsDown, MessageSquare
} from 'lucide-react';
import { NotebookCell as CellType, CELL_TYPE_CONFIG, CELL_STATUS_CONFIG } from '@/config/notebooks';

interface CriticReviewLog {
    type: 'critic_review';
    timestamp: string;
    approved: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
    reasoning: string;
}

interface NotebookCellProps {
    cell: CellType;
    isRunning: boolean;
    onUpdate: (cellId: string, updates: Partial<CellType>) => void;
    onDelete: (cellId: string) => void;
    onRunCell: (cellId: string) => void;
    onAddDependency: (cellId: string, dependencyId: string) => void;
    onApprove?: (cellId: string) => void;
    onReject?: (cellId: string) => void;
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
    onApprove,
    onReject,
    availableCells,
    dragHandleProps
}: NotebookCellProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(cell.content);
    const [showDependencies, setShowDependencies] = useState(false);
    const [showGlassCockpit, setShowGlassCockpit] = useState(false);

    const cellConfig = CELL_TYPE_CONFIG[cell.cell_type];
    const statusConfig = CELL_STATUS_CONFIG[cell.status];

    // Extract critic review from execution log
    const criticReview = cell.execution_log?.find(
        (log: any) => log.type === 'critic_review'
    ) as CriticReviewLog | undefined;

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
            ${cell.status === 'paused' ? 'border-orange-300 ring-2 ring-orange-100' : ''}
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

                {/* Critic Badge */}
                {criticReview && (
                    <div className={`
                        flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                        ${criticReview.approved 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }
                    `}>
                        <Shield className="w-3 h-3" />
                        <span>{criticReview.confidence}%</span>
                    </div>
                )}

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
                    {(criticReview || cell.reasoning) && (
                        <button
                            onClick={() => setShowGlassCockpit(!showGlassCockpit)}
                            className={`p-1.5 rounded hover:bg-gray-200 ${showGlassCockpit ? 'bg-blue-100' : ''}`}
                            title="Glass Cockpit"
                        >
                            <Eye className="w-4 h-4 text-blue-500" />
                        </button>
                    )}
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

            {/* Human-in-the-Loop Approval Banner */}
            {cell.cell_type === 'approve' && cell.status === 'paused' && (
                <div className="p-4 bg-orange-50 border-b border-orange-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="font-medium text-orange-900">Human Approval Required</p>
                                <p className="text-sm text-orange-700">Review the previous outputs before continuing</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onReject?.(cell.id)}
                                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2"
                            >
                                <ThumbsDown className="w-4 h-4" />
                                Reject
                            </button>
                            <button
                                onClick={() => onApprove?.(cell.id)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                            >
                                <ThumbsUp className="w-4 h-4" />
                                Approve & Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Glass Cockpit Panel */}
            {showGlassCockpit && (criticReview || cell.reasoning) && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                    <div className="flex items-center gap-2 mb-3">
                        <Eye className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Glass Cockpit</span>
                        <span className="text-xs text-blue-600">Agent Transparency</span>
                    </div>

                    {/* Critic Review */}
                    {criticReview && (
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">Critic Agent Review</span>
                                <span className={`
                                    px-2 py-0.5 rounded-full text-xs font-medium
                                    ${criticReview.approved 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-yellow-100 text-yellow-700'
                                    }
                                `}>
                                    {criticReview.approved ? '✓ Approved' : '⚠ Flagged'}
                                </span>
                            </div>
                            
                            {/* Confidence Meter */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                    <span>Confidence</span>
                                    <span>{criticReview.confidence}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all ${
                                            criticReview.confidence >= 80 ? 'bg-green-500' :
                                            criticReview.confidence >= 60 ? 'bg-yellow-500' :
                                            'bg-red-500'
                                        }`}
                                        style={{ width: `${criticReview.confidence}%` }}
                                    />
                                </div>
                            </div>

                            {/* Issues */}
                            {criticReview.issues.length > 0 && (
                                <div className="mb-2">
                                    <p className="text-xs font-medium text-gray-600 mb-1">Issues Found:</p>
                                    <ul className="text-xs text-red-600 space-y-1">
                                        {criticReview.issues.map((issue, i) => (
                                            <li key={i} className="flex items-start gap-1">
                                                <span>•</span>
                                                <span>{issue}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Suggestions */}
                            {criticReview.suggestions.length > 0 && (
                                <div className="mb-2">
                                    <p className="text-xs font-medium text-gray-600 mb-1">Suggestions:</p>
                                    <ul className="text-xs text-blue-600 space-y-1">
                                        {criticReview.suggestions.map((suggestion, i) => (
                                            <li key={i} className="flex items-start gap-1">
                                                <span>💡</span>
                                                <span>{suggestion}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Reasoning */}
                            <div className="text-xs text-gray-500 italic">
                                {criticReview.reasoning}
                            </div>
                        </div>
                    )}

                    {/* Agent Reasoning */}
                    {cell.reasoning && (
                        <div className="p-2 bg-white/50 rounded text-xs text-gray-600">
                            <span className="font-medium">Agent: </span>
                            {cell.reasoning}
                        </div>
                    )}

                    {/* Tools Used */}
                    {cell.tools_used && cell.tools_used.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Tools:</span>
                            {cell.tools_used.map((tool, i) => (
                                <span key={i} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600">
                                    {tool}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Cost & Tokens */}
                    {(cell.tokens_input || cell.cost) && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            {cell.tokens_input && <span>Tokens: {cell.tokens_input}</span>}
                            {cell.cost && <span>Cost: ${cell.cost.toFixed(6)}</span>}
                        </div>
                    )}
                </div>
            )}

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
                                {criticReview && !criticReview.approved && (
                                    <span className="px-1.5 py-0.5 bg-yellow-100 rounded text-yellow-700 text-[10px]">
                                        ⚠ Review suggested
                                    </span>
                                )}
                            </p>
                            <div className={`
                                p-3 rounded-lg border
                                ${criticReview && !criticReview.approved 
                                    ? 'bg-yellow-50 border-yellow-200' 
                                    : 'bg-green-50 border-green-200'
                                }
                            `}>
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
                </div>
            )}
        </div>
    );
}
