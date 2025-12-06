// app/workstation/notebooks/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, Search, Loader2, BookOpen, Play, Clock, 
    CheckCircle, AlertTriangle, Trash2, MoreVertical,
    FileText, LayoutTemplate
} from 'lucide-react';
import { Notebook, NotebookTemplate, TEMPLATE_CATEGORIES } from '@/config/notebooks';

export default function NotebooksPage() {
    const router = useRouter();
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [templates, setTemplates] = useState<NotebookTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showTemplates, setShowTemplates] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Fetch notebooks
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [notebooksRes, templatesRes] = await Promise.all([
                    fetch('/api/notebooks'),
                    fetch('/api/notebooks/templates').catch(() => ({ ok: false }))
                ]);

                if (notebooksRes.ok) {
                    const data = await notebooksRes.json();
                    setNotebooks(data.notebooks || []);
                }

                if (templatesRes.ok) {
                    const data = await (templatesRes as Response).json();
                    setTemplates(data.templates || []);
                }
            } catch (err) {
                console.error('Failed to fetch notebooks:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Create new notebook
    const createNotebook = async (templateId?: string) => {
        setIsCreating(true);
        try {
            const response = await fetch('/api/notebooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Untitled Notebook',
                    templateId,
                }),
            });

            if (!response.ok) throw new Error('Failed to create notebook');

            const data = await response.json();
            router.push(`/workstation/notebooks/${data.notebook.id}`);
        } catch (err) {
            console.error('Failed to create notebook:', err);
        } finally {
            setIsCreating(false);
        }
    };

    // Delete notebook
    const deleteNotebook = async (id: string) => {
        if (!confirm('Are you sure you want to delete this notebook?')) return;

        try {
            await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
            setNotebooks(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error('Failed to delete notebook:', err);
        }
    };

    // Filter notebooks by search
    const filteredNotebooks = notebooks.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'running': return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
            case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            default: return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BookOpen className="w-7 h-7" />
                        Business Notebooks
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Create and run multi-step workflows in natural language
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                        <LayoutTemplate className="w-4 h-4" />
                        Templates
                    </button>
                    <button
                        onClick={() => createNotebook()}
                        disabled={isCreating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isCreating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        New Notebook
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search notebooks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Templates Section */}
            {showTemplates && (
                <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <LayoutTemplate className="w-5 h-5" />
                        Start from a Template
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.length > 0 ? templates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => createNotebook(template.id)}
                                className="p-4 bg-white rounded-lg border hover:border-blue-300 hover:shadow-md transition-all text-left"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-2xl">{template.icon}</span>
                                    <div>
                                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                                        <p className="text-xs text-gray-500">{template.category}</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600">{template.description}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                    {template.cells_template?.length || 0} cells • Used {template.usage_count} times
                                </p>
                            </button>
                        )) : (
                            <p className="text-gray-500 col-span-3">No templates available. Create one from a notebook!</p>
                        )}
                    </div>
                </div>
            )}

            {/* Notebooks Grid */}
            {filteredNotebooks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNotebooks.map(notebook => (
                        <div
                            key={notebook.id}
                            className="bg-white rounded-lg border hover:border-gray-300 hover:shadow-md transition-all"
                        >
                            <div
                                onClick={() => router.push(`/workstation/notebooks/${notebook.id}`)}
                                className="p-4 cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{notebook.icon}</span>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{notebook.title}</h3>
                                            <p className="text-xs text-gray-500">
                                                {notebook.cell_count || 0} cells
                                            </p>
                                        </div>
                                    </div>
                                    {getStatusIcon(notebook.status)}
                                </div>

                                {notebook.description && (
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                        {notebook.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>
                                        Updated {new Date(notebook.updated_at).toLocaleDateString()}
                                    </span>
                                    {notebook.last_run_duration_ms && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {notebook.last_run_duration_ms < 1000 
                                                ? `${notebook.last_run_duration_ms}ms`
                                                : `${(notebook.last_run_duration_ms / 1000).toFixed(1)}s`
                                            }
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="px-4 py-2 border-t bg-gray-50 rounded-b-lg flex items-center justify-between">
                                <button
                                    onClick={() => router.push(`/workstation/notebooks/${notebook.id}`)}
                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                    <Play className="w-3 h-3" />
                                    Open
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteNotebook(notebook.id);
                                    }}
                                    className="text-sm text-red-500 hover:text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No notebooks yet</h3>
                    <p className="text-gray-500 mb-6">
                        Create your first notebook to start building business workflows
                    </p>
                    <button
                        onClick={() => createNotebook()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Create Your First Notebook
                    </button>
                </div>
            )}
        </div>
    );
}
