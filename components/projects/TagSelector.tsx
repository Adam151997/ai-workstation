// components/projects/TagSelector.tsx
// Multi-select component for document tags

'use client';

import { useState, useEffect } from 'react';
import { Tag, Plus, X } from 'lucide-react';

interface TagItem {
    id: string;
    name: string;
    color: string;
    usageCount: number;
}

interface TagSelectorProps {
    selectedTagIds: string[];
    onSelect: (tagIds: string[]) => void;
    allowCreate?: boolean;
    className?: string;
}

export function TagSelector({
    selectedTagIds,
    onSelect,
    allowCreate = true,
    className = '',
}: TagSelectorProps) {
    const [tags, setTags] = useState<TagItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [newTagName, setNewTagName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        try {
            const response = await fetch('/api/tags');
            const data = await response.json();
            if (data.success) {
                setTags(data.tags);
            }
        } catch (error) {
            console.error('Failed to fetch tags:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;

        try {
            const response = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTagName.trim() }),
            });

            const data = await response.json();
            if (data.success) {
                setTags([...tags, data.tag]);
                onSelect([...selectedTagIds, data.tag.id]);
                setNewTagName('');
            }
        } catch (error) {
            console.error('Failed to create tag:', error);
        }
    };

    const toggleTag = (tagId: string) => {
        if (selectedTagIds.includes(tagId)) {
            onSelect(selectedTagIds.filter(id => id !== tagId));
        } else {
            onSelect([...selectedTagIds, tagId]);
        }
    };

    const removeTag = (tagId: string) => {
        onSelect(selectedTagIds.filter(id => id !== tagId));
    };

    const selectedTags = tags.filter(t => selectedTagIds.includes(t.id));
    const filteredTags = tags.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !selectedTagIds.includes(t.id)
    );

    return (
        <div className={`relative ${className}`}>
            {/* Selected tags display */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="min-h-[38px] flex flex-wrap items-center gap-1 px-2 py-1 bg-white border rounded-lg cursor-pointer hover:bg-gray-50"
            >
                {selectedTags.length === 0 ? (
                    <span className="text-sm text-gray-400 py-1">Add tags...</span>
                ) : (
                    selectedTags.map((tag) => (
                        <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ 
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                            }}
                        >
                            {tag.name}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeTag(tag.id);
                                }}
                                className="hover:bg-white/50 rounded-full p-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {/* Search/Create input */}
                    <div className="p-2 border-b sticky top-0 bg-white">
                        <input
                            type="text"
                            value={newTagName || searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setNewTagName(e.target.value);
                            }}
                            placeholder="Search or create tag..."
                            className="w-full px-2 py-1 text-sm border rounded"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTagName.trim()) {
                                    handleCreateTag();
                                }
                                if (e.key === 'Escape') {
                                    setIsOpen(false);
                                }
                            }}
                        />
                    </div>

                    {isLoading ? (
                        <div className="p-3 text-center text-gray-500 text-sm">Loading...</div>
                    ) : (
                        <>
                            {/* Existing tags */}
                            {filteredTags.map((tag) => (
                                <button
                                    key={tag.id}
                                    onClick={() => toggleTag(tag.id)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                    <div className="flex items-center gap-2">
                                        <Tag 
                                            className="w-4 h-4"
                                            style={{ color: tag.color }}
                                        />
                                        <span>{tag.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {tag.usageCount}
                                    </span>
                                </button>
                            ))}

                            {/* Create new tag option */}
                            {allowCreate && newTagName.trim() && !tags.some(t => 
                                t.name.toLowerCase() === newTagName.trim().toLowerCase()
                            ) && (
                                <button
                                    onClick={handleCreateTag}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Create "{newTagName.trim()}"</span>
                                </button>
                            )}

                            {filteredTags.length === 0 && !newTagName.trim() && (
                                <div className="p-3 text-center text-gray-500 text-sm">
                                    No more tags available
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Click outside to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}

export default TagSelector;
