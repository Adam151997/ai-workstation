// app/settings/projects/page.tsx
// Projects management page
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    FolderKanban, 
    Plus, 
    Edit2, 
    Trash2, 
    Archive,
    ArchiveRestore,
    Loader2,
    FileText,
    MoreVertical
} from 'lucide-react';

interface Project {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string | null;
    documentCount: number;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
}

const PROJECT_COLORS = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#6366F1', // indigo
];

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showArchived, setShowArchived] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: PROJECT_COLORS[0],
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadProjects();
    }, [showArchived]);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects?includeArchived=${showArchived}`);
            const data = await res.json();
            if (data.success) {
                setProjects(data.projects);
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name.trim()) return;
        
        try {
            setSaving(true);
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            
            if (data.success) {
                setProjects(prev => [...prev, data.project]);
                setIsCreating(false);
                setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingProject || !formData.name.trim()) return;
        
        try {
            setSaving(true);
            const res = await fetch('/api/projects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingProject.id,
                    ...formData,
                }),
            });
            const data = await res.json();
            
            if (data.success) {
                setProjects(prev => prev.map(p => 
                    p.id === editingProject.id ? data.project : p
                ));
                setEditingProject(null);
                setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to update project:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleArchive = async (project: Project) => {
        try {
            const res = await fetch('/api/projects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: project.id,
                    is_archived: !project.isArchived,
                }),
            });
            const data = await res.json();
            
            if (data.success) {
                if (showArchived) {
                    setProjects(prev => prev.map(p => 
                        p.id === project.id ? data.project : p
                    ));
                } else {
                    setProjects(prev => prev.filter(p => p.id !== project.id));
                }
            }
        } catch (error) {
            console.error('Failed to archive project:', error);
        }
    };

    const handleDelete = async (project: Project) => {
        if (!confirm(`Delete "${project.name}"? This will remove the project but keep its documents.`)) {
            return;
        }
        
        try {
            const res = await fetch(`/api/projects?id=${project.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            
            if (data.success) {
                setProjects(prev => prev.filter(p => p.id !== project.id));
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to delete project:', error);
        }
    };

    const startEditing = (project: Project) => {
        setEditingProject(project);
        setFormData({
            name: project.name,
            description: project.description || '',
            color: project.color,
        });
        setIsCreating(false);
    };

    const cancelEditing = () => {
        setEditingProject(null);
        setIsCreating(false);
        setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
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
                        <FolderKanban className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold">Projects</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="rounded"
                            />
                            Show archived
                        </label>
                        <Button
                            onClick={() => {
                                setIsCreating(true);
                                setEditingProject(null);
                                setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
                            }}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Project
                        </Button>
                    </div>
                </div>
                <p className="text-gray-600">
                    Organize your documents into projects for better RAG filtering and retrieval.
                </p>
            </div>

            {/* Create/Edit Form */}
            {(isCreating || editingProject) && (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="font-semibold mb-4">
                        {editingProject ? 'Edit Project' : 'Create New Project'}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Project name"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Project description"
                                rows={2}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Color
                            </label>
                            <div className="flex gap-2">
                                {PROJECT_COLORS.map(color => (
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
                                onClick={editingProject ? handleUpdate : handleCreate}
                                disabled={saving || !formData.name.trim()}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : editingProject ? 'Update Project' : 'Create Project'}
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

            {/* Projects List */}
            <div className="bg-white rounded-lg border">
                {projects.length === 0 ? (
                    <div className="p-12 text-center">
                        <FolderKanban className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
                        <p className="text-gray-600 mb-4">Create your first project to organize documents.</p>
                        <Button
                            onClick={() => setIsCreating(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Project
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y">
                        {projects.map(project => (
                            <div 
                                key={project.id}
                                className={`p-4 flex items-center justify-between hover:bg-gray-50 ${
                                    project.isArchived ? 'opacity-60' : ''
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div 
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${project.color}20` }}
                                    >
                                        <FolderKanban 
                                            className="w-5 h-5" 
                                            style={{ color: project.color }}
                                        />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                            {project.name}
                                            {project.isArchived && (
                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                                                    Archived
                                                </span>
                                            )}
                                        </h4>
                                        {project.description && (
                                            <p className="text-sm text-gray-600">{project.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                            <FileText className="w-3 h-3" />
                                            {project.documentCount} documents
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => startEditing(project)}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleArchive(project)}
                                        title={project.isArchived ? 'Restore' : 'Archive'}
                                    >
                                        {project.isArchived ? (
                                            <ArchiveRestore className="w-4 h-4" />
                                        ) : (
                                            <Archive className="w-4 h-4" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(project)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
