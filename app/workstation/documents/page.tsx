// app/workstation/documents/page.tsx - Full featured with search
'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Upload as UploadIcon, Sparkles, FolderKanban, Filter, Settings, ArrowLeft, Search, X } from 'lucide-react';
import Link from 'next/link';
import DocumentUpload from '@/components/documents/DocumentUpload';
import DocumentLibrary from '@/components/documents/DocumentLibrary';
import { ProjectSelector } from '@/components/projects/ProjectSelector';

interface SearchResult {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  projectName?: string;
  projectColor?: string;
  relevanceScore: number;
  matchingChunks: { text: string; score: number }[];
}

export default function DocumentsPage() {
  const [selectedMode, setSelectedMode] = useState('Sales');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upload' | 'artifact'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'semantic' | 'text'>('semantic');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const modes = ['Sales', 'Marketing', 'Admin'];

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
    setShowUpload(false);
  };

  const executeSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      setSearching(true);
      const params = new URLSearchParams({
        q: searchQuery,
        mode: selectedMode,
        type: searchType,
      });
      if (selectedProjectId) {
        params.set('projectId', selectedProjectId);
      }

      const response = await fetch(`/api/documents/search?${params}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.results);
      } else {
        console.error('Search failed:', data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectedMode, searchType, selectedProjectId]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, executeSearch]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const highlightMatch = (text: string, maxLength = 200) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-4">
          <Link
            href="/workstation"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Workstation</span>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <FileText className="mr-3 h-8 w-8 text-blue-600" />
                Document Library
              </h1>
              <p className="mt-2 text-gray-600">
                Upload, search, and organize your documents with AI-powered semantic search.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/settings/projects"
                className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Manage Projects & Tags"
              >
                <Settings className="h-5 w-5" />
              </Link>
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <UploadIcon className="h-5 w-5" />
                <span>{showUpload ? 'Cancel' : 'Upload Document'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {showUpload && (
          <div className="mb-8 bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upload New Document
            </h2>
            <DocumentUpload 
              mode={selectedMode} 
              onUploadComplete={handleUploadComplete}
            />
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by content..."
                className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'semantic' | 'text')}
              className="px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="semantic">🧠 Semantic Search</option>
              <option value="text">📝 Text Search</option>
            </select>
          </div>
          {searchQuery && (
            <p className="mt-2 text-xs text-gray-500">
              {searchType === 'semantic' 
                ? 'Semantic search finds conceptually related content using AI embeddings'
                : 'Text search finds exact keyword matches in document content'
              }
            </p>
          )}
        </div>

        {/* Search Results */}
        {searchResults !== null && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-600" />
                  Search Results
                  <span className="text-sm font-normal text-gray-500">
                    ({searchResults.length} found)
                  </span>
                </h2>
                <button
                  onClick={clearSearch}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear search
                </button>
              </div>
            </div>
            <div className="p-4">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No documents found matching "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {result.filename}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              {result.projectName && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: `${result.projectColor}15`,
                                    color: result.projectColor,
                                  }}
                                >
                                  {result.projectName}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {(result.relevanceScore * 100).toFixed(0)}% match
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {result.matchingChunks.length > 0 && (
                        <div className="mt-3 pl-8">
                          <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border-l-2 border-yellow-400">
                            ...{highlightMatch(result.matchingChunks[0].text)}...
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters Bar - Only show when not searching */}
        {searchResults === null && (
          <>
            <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <div className="flex flex-wrap items-center gap-4">
                {/* Mode Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Mode:</span>
                  <div className="flex space-x-1">
                    {modes.map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSelectedMode(mode)}
                        className={`
                          px-3 py-1.5 rounded-lg font-medium text-sm transition-colors
                          ${selectedMode === mode
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }
                        `}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-6 w-px bg-gray-300" />

                {/* Project Filter */}
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-gray-500" />
                  <ProjectSelector
                    selectedProjectId={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    allowAll={true}
                    allowCreate={false}
                    className="w-48"
                  />
                </div>

                <div className="h-6 w-px bg-gray-300" />

                {/* Type Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="upload">Uploaded</option>
                    <option value="artifact">AI Generated</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Document Library */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {filter === 'all' && 'All Documents'}
                  {filter === 'upload' && (
                    <>
                      <FileText className="h-5 w-5 text-blue-600" />
                      Uploaded Documents
                    </>
                  )}
                  {filter === 'artifact' && (
                    <>
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      AI-Generated Artifacts
                    </>
                  )}
                  <span className="text-sm font-normal text-gray-500">
                    ({selectedMode})
                  </span>
                </h2>
              </div>
              <DocumentLibrary 
                mode={selectedMode} 
                refreshTrigger={refreshTrigger}
                filter={filter}
                projectId={selectedProjectId}
              />
            </div>
          </>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            💡 Search Tips
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Semantic search</strong> finds conceptually related content (e.g., "customer complaints" finds "client feedback")</li>
            <li>• <strong>Text search</strong> finds exact keyword matches</li>
            <li>• Use projects and tags to organize and filter documents</li>
            <li>• Bulk select documents to apply tags or change projects at once</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
