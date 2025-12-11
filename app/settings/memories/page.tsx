// app/settings/memories/page.tsx
// Agent Memory Management - View, search, and delete memories
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Brain,
    Search,
    Trash2,
    RefreshCw,
    Loader2,
    Filter,
    Sparkles,
    AlertTriangle,
    CheckCircle,
    Lightbulb,
    Heart,
    Target,
    MessageSquare,
    Zap,
    MoreVertical,
    Download,
    Merge
} from 'lucide-react';

interface Memory {
    id: string;
    type: 'fact' | 'preference' | 'context' | 'decision' | 'outcome';
    content: string;
    source: string;
    relevance: number;
    metadata: Record<string, any>;
    hasEmbedding: boolean;
    createdAt: string;
    updatedAt: string;
    expiresAt: string | null;
}

interface MemoryStats {
    type: string;
    count: number;
    avgRelevance: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    fact: { 
        icon: <Lightbulb className="w-4 h-4" />, 
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        label: 'Fact'
    },
    preference: { 
        icon: <Heart className="w-4 h-4" />, 
        color: 'bg-pink-100 text-pink-700 border-pink-200',
        label: 'Preference'
    },
    context: { 
        icon: <MessageSquare className="w-4 h-4" />, 
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        label: 'Context'
    },
    decision: { 
        icon: <Target className="w-4 h-4" />, 
        color: 'bg-green-100 text-green-700 border-green-200',
        label: 'Decision'
    },
    outcome: { 
        icon: <CheckCircle className="w-4 h-4" />, 
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        label: 'Outcome'
    },
};

const SOURCE_COLORS: Record<string, string> = {
    general: 'bg-gray-100 text-gray-700',
    sales: 'bg-emerald-100 text-emerald-700',
    marketing: 'bg-violet-100 text-violet-700',
    research: 'bg-blue-100 text-blue-700',
    code: 'bg-orange-100 text-orange-700',
    data: 'bg-cyan-100 text-cyan-700',
    router: 'bg-indigo-100 text-indigo-700',
};

export default function MemoriesPage() {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [stats, setStats] = useState<MemoryStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [total, setTotal] = useState(0);
    
    // Filters
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Confirmation modals
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<'selected' | 'all' | 'type' | null>(null);

    const loadMemories = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                limit: '50',
                offset: ((page - 1) * 50).toString(),
            });

            if (typeFilter !== 'all') params.set('type', typeFilter);
            if (sourceFilter !== 'all') params.set('source', sourceFilter);
            if (search) params.set('search', search);

            const res = await fetch(`/api/memories?${params}`);
            const data = await res.json();

            if (data.success) {
                setMemories(data.memories);
                setTotal(data.total);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to load memories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMemories();
    }, [page, typeFilter, sourceFilter]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            setPage(1);
            loadMemories();
        }, 300);
        return () => clearTimeout(debounce);
    }, [search]);

    const handleDelete = async (memoryId: string) => {
        try {
            const res = await fetch(`/api/memories?id=${memoryId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setMemories(prev => prev.filter(m => m.id !== memoryId));
                setTotal(prev => prev - 1);
            }
        } catch (error) {
            console.error('Failed to delete memory:', error);
        }
    };

    const handleBulkDelete = async () => {
        try {
            setActionLoading(true);
            
            if (deleteTarget === 'all') {
                await fetch(`/api/memories?all=true`, { method: 'DELETE' });
            } else if (deleteTarget === 'type' && typeFilter !== 'all') {
                await fetch(`/api/memories?all=true&type=${typeFilter}`, { method: 'DELETE' });
            } else if (deleteTarget === 'selected') {
                for (const id of selectedIds) {
                    await fetch(`/api/memories?id=${id}`, { method: 'DELETE' });
                }
            }

            setSelectedIds(new Set());
            setShowDeleteConfirm(false);
            setDeleteTarget(null);
            loadMemories();
        } catch (error) {
            console.error('Failed to delete memories:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleConsolidate = async () => {
        try {
            setActionLoading(true);
            const res = await fetch('/api/memories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'consolidate' }),
            });
            const data = await res.json();
            if (data.success) {
                alert(`Consolidation complete: ${data.merged} merged, ${data.removed} removed`);
                loadMemories();
            }
        } catch (error) {
            console.error('Failed to consolidate:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDecay = async () => {
        try {
            setActionLoading(true);
            const res = await fetch('/api/memories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'decay', daysThreshold: 30 }),
            });
            const data = await res.json();
            if (data.success) {
                alert(`Applied decay to ${data.affected} old memories`);
                loadMemories();
            }
        } catch (error) {
            console.error('Failed to apply decay:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        if (selectedIds.size === memories.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(memories.map(m => m.id)));
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getRelevanceColor = (relevance: number) => {
        if (relevance >= 0.8) return 'text-green-600';
        if (relevance >= 0.5) return 'text-amber-600';
        return 'text-gray-500';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Brain className="w-6 h-6 text-purple-600" />
                        <div>
                            <h2 className="text-xl font-semibold">Agent Memory</h2>
                            <p className="text-sm text-gray-500">
                                {total} memories stored • Semantic search enabled
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleConsolidate}
                            disabled={actionLoading}
                        >
                            <Merge className="w-4 h-4 mr-2" />
                            Consolidate
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleDecay}
                            disabled={actionLoading}
                        >
                            <Zap className="w-4 h-4 mr-2" />
                            Apply Decay
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => loadMemories()}
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                    {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                        const stat = stats.find(s => s.type === type);
                        return (
                            <div 
                                key={type}
                                className={`p-3 rounded-lg border ${config.color} cursor-pointer transition ${
                                    typeFilter === type ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                                }`}
                                onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                            >
                                <div className="flex items-center gap-2">
                                    {config.icon}
                                    <span className="font-medium">{config.label}</span>
                                </div>
                                <p className="text-2xl font-bold mt-1">{stat?.count || 0}</p>
                                <p className="text-xs opacity-75">
                                    Avg relevance: {stat?.avgRelevance || '0.00'}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search memories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                </div>

                {/* Source Filter */}
                <select
                    value={sourceFilter}
                    onChange={(e) => {
                        setSourceFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                    <option value="all">All sources</option>
                    <option value="general">General</option>
                    <option value="sales">Sales</option>
                    <option value="marketing">Marketing</option>
                    <option value="research">Research</option>
                    <option value="code">Code</option>
                    <option value="data">Data</option>
                </select>

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                    <Button
                        variant="destructive"
                        onClick={() => {
                            setDeleteTarget('selected');
                            setShowDeleteConfirm(true);
                        }}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete {selectedIds.size} selected
                    </Button>
                )}

                {/* Delete All */}
                <Button
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => {
                        setDeleteTarget(typeFilter !== 'all' ? 'type' : 'all');
                        setShowDeleteConfirm(true);
                    }}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {typeFilter !== 'all' ? `Delete all ${typeFilter}` : 'Delete all'}
                </Button>
            </div>

            {/* Memories List */}
            <div className="bg-white rounded-lg border">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                ) : memories.length === 0 ? (
                    <div className="p-12 text-center">
                        <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No memories found</h3>
                        <p className="text-gray-600">
                            Agent memories are automatically created during conversations.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-4">
                            <input
                                type="checkbox"
                                checked={selectedIds.size === memories.length && memories.length > 0}
                                onChange={selectAll}
                                className="rounded"
                            />
                            <span className="text-sm text-gray-500">
                                {selectedIds.size > 0 
                                    ? `${selectedIds.size} selected` 
                                    : `Showing ${memories.length} of ${total}`
                                }
                            </span>
                        </div>

                        {/* Items */}
                        <div className="divide-y">
                            {memories.map((memory) => {
                                const typeConfig = TYPE_CONFIG[memory.type] || TYPE_CONFIG.fact;
                                return (
                                    <div 
                                        key={memory.id} 
                                        className={`p-4 hover:bg-gray-50 ${
                                            selectedIds.has(memory.id) ? 'bg-purple-50' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(memory.id)}
                                                onChange={() => toggleSelect(memory.id)}
                                                className="mt-1 rounded"
                                            />
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeConfig.color}`}>
                                                        {typeConfig.icon}
                                                        {typeConfig.label}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[memory.source] || SOURCE_COLORS.general}`}>
                                                        {memory.source}
                                                    </span>
                                                    {memory.hasEmbedding && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                                            <Sparkles className="w-3 h-3 inline mr-1" />
                                                            Embedded
                                                        </span>
                                                    )}
                                                    <span className={`text-xs font-medium ${getRelevanceColor(memory.relevance)}`}>
                                                        {(memory.relevance * 100).toFixed(0)}% relevance
                                                    </span>
                                                </div>
                                                
                                                <p className="text-gray-900 mb-2">
                                                    {memory.content}
                                                </p>
                                                
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span>Created: {formatDate(memory.createdAt)}</span>
                                                    {memory.updatedAt !== memory.createdAt && (
                                                        <span>Updated: {formatDate(memory.updatedAt)}</span>
                                                    )}
                                                    <span className="font-mono text-gray-400">
                                                        {memory.id.substring(0, 16)}...
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(memory.id)}
                                                className="text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {total > 50 && (
                            <div className="p-4 border-t flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                    Page {page} of {Math.ceil(total / 50)}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page * 50 >= total}
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                            <h3 className="text-lg font-semibold">Confirm Delete</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            {deleteTarget === 'all' && 'Are you sure you want to delete ALL memories? This cannot be undone.'}
                            {deleteTarget === 'type' && `Are you sure you want to delete all "${typeFilter}" memories?`}
                            {deleteTarget === 'selected' && `Are you sure you want to delete ${selectedIds.size} selected memories?`}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteTarget(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleBulkDelete}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4 mr-2" />
                                )}
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 text-sm text-purple-800">
                <strong>🧠 About Agent Memory:</strong> Memories are automatically extracted from your conversations 
                and used to provide context-aware responses. High-relevance memories are prioritized in future interactions. 
                Use "Consolidate" to merge duplicate memories and "Apply Decay" to reduce relevance of old memories.
            </div>
        </div>
    );
}
