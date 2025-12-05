// app/settings/tags/page.tsx
// Tags management page
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Tags as TagsIcon, 
    Plus, 
    Edit2, 
    Trash2, 
    Loader2,
    Hash
} from 'lucide-react';

interface Tag {
    id: string;
    name: string;
    description: string | null;
    color: string;
    usageCount: number;
    createdAt: string;
}

const TAG_COLORS = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#6366F1', // indigo
    '#84CC16', // lime
    '#F97316', // orange
];

export default function TagsPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: TAG_COLORS[0],
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/tags');
            const data = await res.json();
            if (data.success) {
                setTags(data.tags);
            }
        } catch (error) {
            console.error('Failed to load tags:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name.trim()) return;
        
        try {
            setSaving(true);
            const res = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            
            if (data.success) {
                setTags(prev => [...prev, data.tag]);
                setIsCreating(false);
                setFormData({ name: '', description: '', color: TAG_COLORS[0] });
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to create tag:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingTag || !formData.name.trim()) return;
        
        try {
            setSaving(true);
            const res = await fetch('/api/tags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingTag.id,
                    ...formData,
                }),
            });
            const data = await res.json();
            
            if (data.success) {
                setTags(prev => prev.map(t => 
                    t.id === editingTag.id ? data.tag : t
                ));
                setEditingTag(null);
                setFormData({ name: '', description: '', color: TAG_COLORS[0] });
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to update tag:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tag: Tag) => {
        if (tag.usageCount > 0) {
            if (!confirm(`"${tag.name}" is used on ${tag.usageCount} documents. Delete anyway?`)) {
                return;
            }
        } else if (!confirm(`Delete tag "${tag.name}"?`)) {
            return;
        }
        
        try {
            const res = await fetch(`/api/tags?id=${tag.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            
            if (data.success) {
                setTags(prev => prev.filter(t => t.id !== tag.id));
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to delete tag:', error);
        }
    };

    const startEditing = (tag: Tag) => {
        setEditingTag(tag);
        setFormData({
            name: tag.name,
            description: tag.description || '',
            color: tag.color,
        });
        setIsCreating(false);
    };

    const cancelEditing = () => {
        setEditingTag(null);
        setIsCreating(false);
        setFormData({ name: '', description: '', color: TAG_COLORS[0] });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <TagsIcon className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold">Tags</h2>
                    </div>
                    <Button
                        onClick={() => {
                            setIsCreating(true);
                            setEditingTag(null);
                            setFormData({ name: '', description: '', color: TAG_COLORS[0] });
                        }}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Tag
                    </Button>
                </div>
                <p className="text-gray-600">
                    Create tags to label and filter your documents. Use tags like "urgent", "contract", or "review" for quick filtering.
                </p>
            </div>

            {/* Create/Edit Form */}
            {(isCreating || editingTag) && (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="font-semibold mb-4">
                        {editingTag ? 'Edit Tag' : 'Create New Tag'}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ 
                                        ...prev, 
                                        name: e.target.value.toLowerCase().replace(/\s+/g, '-')
                                    }))}
                                    placeholder="tag-name"
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Lowercase, no spaces (use hyphens)
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (optional)
                            </label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="What is this tag for?"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Color
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {TAG_COLORS.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                                            formData.color === color 
                                                ? 'border-gray-900 scale-110' 
                                                : 'border-transparent hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button
                                onClick={editingTag ? handleUpdate : handleCreate}
                                disabled={saving || !formData.name.trim()}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : editingTag ? 'Update Tag' : 'Create Tag'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={cancelEditing}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tags List */}
            <div className="bg-white rounded-lg border">
                {tags.length === 0 ? (
                    <div className="p-12 text-center">
                        <TagsIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No tags yet</h3>
                        <p className="text-gray-600 mb-4">Create tags to organize and filter your documents.</p>
                        <Button
                            onClick={() => setIsCreating(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Tag
                        </Button>
                    </div>
                ) : (
                    <div className="p-6">
                        <div className="flex flex-wrap gap-3">
                            {tags.map(tag => (
                                <div 
                                    key={tag.id}
                                    className="group flex items-center gap-2 px-4 py-2 rounded-full border hover:shadow-sm transition-shadow"
                                    style={{ 
                                        backgroundColor: `${tag.color}10`,
                                        borderColor: `${tag.color}30`,
                                    }}
                                >
                                    <span 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                    <span className="font-medium" style={{ color: tag.color }}>
                                        #{tag.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        ({tag.usageCount})
                                    </span>
                                    <div className="hidden group-hover:flex items-center gap-1 ml-2">
                                        <button
                                            onClick={() => startEditing(tag)}
                                            className="p-1 hover:bg-white rounded"
                                        >
                                            <Edit2 className="w-3 h-3 text-gray-500" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tag)}
                                            className="p-1 hover:bg-white rounded"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Usage Tips */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                <h3 className="font-semibold text-blue-900 mb-2">💡 Tag Tips</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Use tags like <code className="bg-blue-100 px-1 rounded">#urgent</code> or <code className="bg-blue-100 px-1 rounded">#review</code> for priority</li>
                    <li>• Filter documents in chat: "Show me documents tagged urgent"</li>
                    <li>• Combine with projects: "Find contracts in Alpha Project tagged review"</li>
                    <li>• Tags are automatically suggested when uploading documents</li>
                </ul>
            </div>
        </div>
    );
}
