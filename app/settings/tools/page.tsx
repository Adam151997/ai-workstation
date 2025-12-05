// app/settings/tools/page.tsx - Tool Management Settings
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Search, Loader2, Sparkles, Wrench } from 'lucide-react';

interface Tool {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_url: string | null;
  category: string;
  is_premium: boolean;
  requires_auth: boolean;
  popularity_score: number;
}

interface Category {
  category: string;
  tool_count: string;
}

export default function ToolSettingsPage() {
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [enabledSlugs, setEnabledSlugs] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [catalogRes, userRes, categoriesRes] = await Promise.all([
        fetch('/api/tools/catalog'),
        fetch('/api/tools/user'),
        fetch('/api/tools/categories')
      ]);

      const catalogData = await catalogRes.json();
      const userData = await userRes.json();
      const categoriesData = await categoriesRes.json();

      if (catalogData.success) {
        setAllTools(catalogData.tools);
      }

      if (userData.success) {
        setEnabledSlugs(userData.tools.map((t: Tool) => t.slug));
      }

      if (categoriesData.success) {
        setCategories(categoriesData.categories);
      }

    } catch (error) {
      console.error('Failed to load tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (slug: string) => {
    setEnabledSlugs(prev => {
      const newSlugs = prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : [...prev, slug];
      setHasChanges(true);
      return newSlugs;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/tools/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools: enabledSlugs })
      });

      const data = await response.json();

      if (data.success) {
        setHasChanges(false);
        alert(`✅ Toolkit saved! ${data.toolCount} tools enabled.`);
      } else {
        alert(`❌ Failed to save: ${data.error}`);
      }

    } catch (error) {
      console.error('Failed to save tools:', error);
      alert('❌ Failed to save toolkit');
    } finally {
      setSaving(false);
    }
  };

  const filteredTools = allTools.filter(tool => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
            <Wrench className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold">My Toolkit</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">Enabled</div>
              <div className="text-2xl font-bold text-blue-600">{enabledSlugs.length}</div>
            </div>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {hasChanges ? 'Save Changes' : 'Saved'}
                </>
              )}
            </Button>
          </div>
        </div>
        <p className="text-gray-600">
          Choose the tools that power your AI workspace. Click a tool to enable or disable it.
        </p>

        {/* Search and Filter */}
        <div className="mt-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.category} value={cat.category}>
                {cat.category} ({cat.tool_count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="bg-white rounded-lg border p-6">
        {filteredTools.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No tools found matching your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map(tool => {
              const isEnabled = enabledSlugs.includes(tool.slug);

              return (
                <div
                  key={tool.id}
                  onClick={() => handleToggle(tool.slug)}
                  className={`
                    p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${isEnabled
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        {tool.name}
                        {tool.is_premium && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Premium
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-gray-500">{tool.category}</span>
                    </div>
                    {isEnabled && (
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{tool.description}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Popularity: {tool.popularity_score}</span>
                    {tool.requires_auth && (
                      <span className="text-orange-600">OAuth</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
