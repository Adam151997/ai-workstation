// components/projects/ProjectSelector.tsx
// Dropdown component for selecting projects

'use client';

import { useState, useEffect } from 'react';
import { Folder, Plus, ChevronDown } from 'lucide-react';

interface Project {
    id: string;
    name: string;
    color: string;
    icon: string;
    documentCount: number;
}

interface ProjectSelectorProps {
    selectedProjectId?: string;
    onSelect: (projectId: string | undefined) => void;
    allowAll?: boolean;
    allowCreate?: boolean;
    className?: string;
}

export function ProjectSelector({
    selectedProjectId,
    onSelect,
    allowAll = true,
    allowCreate = true,
    className = '',
}: ProjectSelectorProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await fetch('/api/projects');
            const data = await response.json();
            if (data.success) {
                setProjects(data.projects);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName.trim() }),
            });

            const data = await response.json();
            if (data.success) {
                setProjects([...projects, data.project]);
                onSelect(data.project.id);
                setNewProjectName('');
                setIsCreating(false);
                setIsOpen(false);
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        }
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: selectedProject?.color || '#6b7280' }}
                    />
                    <span className="truncate">
                        {selectedProject?.name || (allowAll ? 'All Projects' : 'Select Project')}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-3 text-center text-gray-500 text-sm">Loading...</div>
                    ) : (
                        <>
                            {allowAll && (
                                <button
                                    onClick={() => {
                                        onSelect(undefined);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                                        !selectedProjectId ? 'bg-blue-50 text-blue-700' : ''
                                    }`}
                                >
                                    <Folder className="w-4 h-4 text-gray-400" />
                                    <span>All Projects</span>
                                </button>
                            )}

                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => {
                                        onSelect(project.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                                        selectedProjectId === project.id ? 'bg-blue-50 text-blue-700' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded"
                                            style={{ backgroundColor: project.color }}
                                        />
                                        <span className="truncate">{project.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {project.documentCount}
                                    </span>
                                </button>
                            ))}

                            {allowCreate && (
                                <div className="border-t">
                                    {isCreating ? (
                                        <div className="p-2 flex gap-2">
                                            <input
                                                type="text"
                                                value={newProjectName}
                                                onChange={(e) => setNewProjectName(e.target.value)}
                                                placeholder="Project name"
                                                className="flex-1 px-2 py-1 text-sm border rounded"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCreateProject();
                                                    if (e.key === 'Escape') setIsCreating(false);
                                                }}
                                            />
                                            <button
                                                onClick={handleCreateProject}
                                                className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setIsCreating(true)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>New Project</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default ProjectSelector;
