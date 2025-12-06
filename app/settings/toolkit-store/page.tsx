// app/settings/toolkit-store/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
    Search, Download, Check, ExternalLink, Star, 
    Loader2, Filter, Grid, List, Plug, Settings2,
    ChevronRight, Sparkles
} from 'lucide-react';

interface Toolkit {
    id: string;
    name: string;
    slug: string;
    description: string;
    icon_url: string;
    category: string;
    auth_type: string;
    tool_count: number;
    install_count: number;
    is_featured: boolean;
    isInstalled: boolean;
}

interface Category {
    id: string;
    name: string;
    icon: string;
}

export default function ToolkitStorePage() {
    const [toolkits, setToolkits] = useState<Toolkit[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [installingId, setInstallingId] = useState<string | null>(null);

    // Fetch toolkits
    useEffect(() => {
        const fetchToolkits = async () => {
            try {
                const params = new URLSearchParams({
                    view: 'catalog',
                    ...(selectedCategory !== 'all' && { category: selectedCategory }),
                    ...(searchQuery && { search: searchQuery }),
                });

                const response = await fetch(`/api/toolkits?${params}`);
                const data = await response.json();
                
                setToolkits(data.toolkits || []);
                setCategories(data.categories || []);
            } catch (error) {
                console.error('Failed to fetch toolkits:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchToolkits();
    }, [selectedCategory, searchQuery]);

    // Install toolkit
    const installToolkit = async (toolkitId: string) => {
        setInstallingId(toolkitId);
        try {
            const response = await fetch('/api/toolkits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolkitId }),
            });

            if (response.ok) {
                // Mark as installed in local state
                setToolkits(prev => prev.map(t => 
                    t.id === toolkitId ? { ...t, isInstalled: true } : t
                ));
            }
        } catch (error) {
            console.error('Failed to install toolkit:', error);
        } finally {
            setInstallingId(null);
        }
    };

    const featuredToolkits = toolkits.filter(t => t.is_featured && !t.isInstalled);
    const filteredToolkits = toolkits.filter(t => 
        selectedCategory === 'all' || t.category === selectedCategory
    );

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Toolkit Store
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Install integrations to connect your favorite tools and services
                </p>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        placeholder="Search toolkits..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border font-display text-sm"
                        style={{ 
                            background: 'var(--surface-primary)', 
                            borderColor: 'var(--border-primary)',
                            color: 'var(--text-primary)',
                        }}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg border transition-all ${viewMode === 'grid' ? 'border-[var(--accent-primary)] bg-[var(--accent-muted)]' : ''}`}
                        style={{ borderColor: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--border-primary)' }}
                    >
                        <Grid className="w-5 h-5" style={{ color: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg border transition-all ${viewMode === 'list' ? 'border-[var(--accent-primary)] bg-[var(--accent-muted)]' : ''}`}
                        style={{ borderColor: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--border-primary)' }}
                    >
                        <List className="w-5 h-5" style={{ color: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
                    </button>
                </div>
            </div>

            {/* Categories */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-full font-display text-sm font-medium whitespace-nowrap transition-all ${
                        selectedCategory === 'all' 
                            ? 'bg-[var(--accent-primary)] text-white' 
                            : 'border hover:bg-[var(--surface-hover)]'
                    }`}
                    style={{ borderColor: selectedCategory !== 'all' ? 'var(--border-primary)' : undefined }}
                >
                    All Apps
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2 rounded-full font-display text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                            selectedCategory === cat.id 
                                ? 'bg-[var(--accent-primary)] text-white' 
                                : 'border hover:bg-[var(--surface-hover)]'
                        }`}
                        style={{ 
                            borderColor: selectedCategory !== cat.id ? 'var(--border-primary)' : undefined,
                            color: selectedCategory !== cat.id ? 'var(--text-primary)' : undefined,
                        }}
                    >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            ) : (
                <>
                    {/* Featured Section */}
                    {selectedCategory === 'all' && featuredToolkits.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                                <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    Featured Integrations
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {featuredToolkits.slice(0, 6).map((toolkit) => (
                                    <ToolkitCard 
                                        key={toolkit.id} 
                                        toolkit={toolkit}
                                        onInstall={installToolkit}
                                        isInstalling={installingId === toolkit.id}
                                        featured
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Toolkits */}
                    <div>
                        <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                            {selectedCategory === 'all' ? 'All Integrations' : categories.find(c => c.id === selectedCategory)?.name || 'Integrations'}
                        </h2>

                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredToolkits.map((toolkit) => (
                                    <ToolkitCard 
                                        key={toolkit.id} 
                                        toolkit={toolkit}
                                        onInstall={installToolkit}
                                        isInstalling={installingId === toolkit.id}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredToolkits.map((toolkit) => (
                                    <ToolkitListItem 
                                        key={toolkit.id} 
                                        toolkit={toolkit}
                                        onInstall={installToolkit}
                                        isInstalling={installingId === toolkit.id}
                                    />
                                ))}
                            </div>
                        )}

                        {filteredToolkits.length === 0 && (
                            <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
                                <Plug className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="font-display">No toolkits found</p>
                                <p className="text-sm mt-1">Try a different search or category</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// Toolkit Card Component
function ToolkitCard({ toolkit, onInstall, isInstalling, featured }: {
    toolkit: Toolkit;
    onInstall: (id: string) => void;
    isInstalling: boolean;
    featured?: boolean;
}) {
    return (
        <div 
            className={`rounded-xl border p-5 transition-all hover:border-[var(--accent-primary)] ${featured ? 'ring-1 ring-[var(--accent-muted)]' : ''}`}
            style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}
        >
            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: 'var(--surface-secondary)' }}>
                    {toolkit.icon_url ? (
                        <img src={toolkit.icon_url} alt={toolkit.name} className="w-8 h-8 object-contain" />
                    ) : (
                        <Plug className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {toolkit.name}
                        </h3>
                        {featured && (
                            <Star className="w-4 h-4 fill-current" style={{ color: 'var(--warning)' }} />
                        )}
                    </div>
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {toolkit.description}
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{toolkit.tool_count} tools</span>
                    <span>•</span>
                    <span>{toolkit.install_count} installs</span>
                </div>

                {toolkit.isInstalled ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'var(--success-muted)', color: 'var(--success)' }}>
                        <Check className="w-4 h-4" />
                        Installed
                    </div>
                ) : (
                    <button
                        onClick={() => onInstall(toolkit.id)}
                        disabled={isInstalling}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)', color: 'white' }}
                    >
                        {isInstalling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        Install
                    </button>
                )}
            </div>
        </div>
    );
}

// Toolkit List Item Component
function ToolkitListItem({ toolkit, onInstall, isInstalling }: {
    toolkit: Toolkit;
    onInstall: (id: string) => void;
    isInstalling: boolean;
}) {
    return (
        <div 
            className="flex items-center gap-4 rounded-lg border p-4 transition-all hover:border-[var(--accent-primary)]"
            style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}
        >
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: 'var(--surface-secondary)' }}>
                {toolkit.icon_url ? (
                    <img src={toolkit.icon_url} alt={toolkit.name} className="w-6 h-6 object-contain" />
                ) : (
                    <Plug className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {toolkit.name}
                </h3>
                <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                    {toolkit.description}
                </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                <span>{toolkit.tool_count} tools</span>
            </div>

            {/* Action */}
            {toolkit.isInstalled ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'var(--success-muted)', color: 'var(--success)' }}>
                    <Check className="w-4 h-4" />
                    Installed
                </div>
            ) : (
                <button
                    onClick={() => onInstall(toolkit.id)}
                    disabled={isInstalling}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                >
                    {isInstalling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    Install
                </button>
            )}
        </div>
    );
}
