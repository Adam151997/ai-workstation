// components/documents/DocumentLibrary.tsx - Full featured with bulk operations
'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, Trash2, Download, Clock, Layers, Sparkles, FolderKanban, 
  Tag, Edit2, X, Check, Loader2, CheckSquare, Square, MoreHorizontal 
} from 'lucide-react';
import { ProjectSelector } from '@/components/projects/ProjectSelector';
import { TagSelector } from '@/components/projects/TagSelector';

interface TagInfo {
  id: string;
  name: string;
  color: string;
}

interface Document {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  mode: string;
  chunkCount: number;
  sourceType?: 'upload' | 'artifact';
  artifactType?: string;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  tags: TagInfo[];
}

interface DocumentLibraryProps {
  mode: string;
  refreshTrigger?: number;
  filter?: 'all' | 'upload' | 'artifact';
  projectId?: string;
}

export default function DocumentLibrary({ mode, refreshTrigger, filter = 'all', projectId }: DocumentLibraryProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<string | null>(null);
  const [bulkProjectId, setBulkProjectId] = useState<string | undefined>(undefined);
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Edit state
  const [editProjectId, setEditProjectId] = useState<string | undefined>(undefined);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/documents?mode=${mode}`;
      if (projectId) {
        url += `&projectId=${projectId}`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
      setSelectedIds(new Set()); // Clear selection on refresh
    } catch (err: any) {
      console.error('[DocumentLibrary] Error:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [mode, refreshTrigger, projectId]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredDocuments.map(d => d.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Bulk operations
  const executeBulkOperation = async (operation: string) => {
    if (selectedIds.size === 0) return;

    const confirmMessages: Record<string, string> = {
      delete: `Delete ${selectedIds.size} documents? This cannot be undone.`,
      setProject: `Update project for ${selectedIds.size} documents?`,
      setTags: `Replace tags for ${selectedIds.size} documents?`,
      addTags: `Add tags to ${selectedIds.size} documents?`,
    };

    if (operation === 'delete' && !confirm(confirmMessages.delete)) {
      return;
    }

    try {
      setBulkProcessing(true);
      setError(null);

      const body: any = {
        documentIds: Array.from(selectedIds),
        operation,
      };

      if (operation === 'setProject') {
        body.projectId = bulkProjectId || null;
      } else if (operation === 'setTags' || operation === 'addTags') {
        body.tagIds = bulkTagIds;
      }

      const response = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bulk operation failed');
      }

      // Refresh and reset
      await fetchDocuments();
      setBulkOperation(null);
      setShowBulkMenu(false);
      setBulkProjectId(undefined);
      setBulkTagIds([]);

    } catch (err: any) {
      console.error('[Bulk] Error:', err);
      setError(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDelete = async (documentId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(documentId);
      setError(null);

      const response = await fetch(`/api/documents?id=${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (err: any) {
      console.error('[DocumentLibrary] Delete error:', err);
      setError(err.message || 'Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  const startEditing = (doc: Document) => {
    setEditing(doc.id);
    setEditProjectId(doc.projectId);
    setEditTagIds(doc.tags.map(t => t.id));
  };

  const cancelEditing = () => {
    setEditing(null);
    setEditProjectId(undefined);
    setEditTagIds([]);
  };

  const saveEdits = async (documentId: string) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: editProjectId || null,
          tagIds: editTagIds,
          reindex: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update document');
      }

      await fetchDocuments();
      setEditing(null);
    } catch (err: any) {
      console.error('[DocumentLibrary] Update error:', err);
      setError(err.message || 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (doc: Document) => {
    if (doc.sourceType === 'artifact') {
      return <Sparkles className="h-5 w-5 text-purple-500" />;
    }
    return <FileText className="h-5 w-5 text-blue-500" />;
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    if (filter === 'all') return true;
    if (filter === 'upload') return doc.sourceType === 'upload' || !doc.sourceType;
    if (filter === 'artifact') return doc.sourceType === 'artifact';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
        <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
      </div>
    );
  }

  if (filteredDocuments.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">
          {filter === 'artifact' 
            ? 'No AI-generated artifacts yet'
            : 'Upload a document to get started with RAG'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {filteredDocuments.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-3">
            <button
              onClick={selectedIds.size === filteredDocuments.length ? deselectAll : selectAll}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {selectedIds.size === filteredDocuments.length ? (
                <CheckSquare className="h-4 w-4 text-blue-600" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectedIds.size === filteredDocuments.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-sm text-blue-600 font-medium">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              {bulkOperation ? (
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border">
                  {bulkOperation === 'setProject' && (
                    <>
                      <ProjectSelector
                        selectedProjectId={bulkProjectId}
                        onSelect={setBulkProjectId}
                        allowAll={true}
                        allowCreate={false}
                        className="w-48"
                      />
                      <button
                        onClick={() => executeBulkOperation('setProject')}
                        disabled={bulkProcessing}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </button>
                    </>
                  )}
                  {(bulkOperation === 'setTags' || bulkOperation === 'addTags') && (
                    <>
                      <TagSelector
                        selectedTagIds={bulkTagIds}
                        onSelect={setBulkTagIds}
                        allowCreate={false}
                        className="w-64"
                      />
                      <button
                        onClick={() => executeBulkOperation(bulkOperation)}
                        disabled={bulkProcessing}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setBulkOperation(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowBulkMenu(!showBulkMenu)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    Bulk Actions
                  </button>
                  {showBulkMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowBulkMenu(false)} />
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-20">
                        <button
                          onClick={() => { setBulkOperation('setProject'); setShowBulkMenu(false); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FolderKanban className="h-4 w-4" />
                          Set Project
                        </button>
                        <button
                          onClick={() => { setBulkOperation('addTags'); setShowBulkMenu(false); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Tag className="h-4 w-4" />
                          Add Tags
                        </button>
                        <button
                          onClick={() => { setBulkOperation('setTags'); setShowBulkMenu(false); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Tag className="h-4 w-4" />
                          Replace Tags
                        </button>
                        <hr className="my-1" />
                        <button
                          onClick={() => { executeBulkOperation('delete'); setShowBulkMenu(false); }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Selected
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Document List */}
      {filteredDocuments.map((doc) => (
        <div
          key={doc.id}
          className={`bg-white border rounded-lg p-4 transition-all ${
            editing === doc.id ? 'border-blue-400 shadow-md' : 
            selectedIds.has(doc.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:shadow-md'
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            <button
              onClick={() => toggleSelect(doc.id)}
              className="mt-0.5 text-gray-400 hover:text-blue-600"
            >
              {selectedIds.has(doc.id) ? (
                <CheckSquare className="h-5 w-5 text-blue-600" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>

            {/* Document Info */}
            <div className="flex items-start space-x-3 flex-1">
              {getFileIcon(doc)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {doc.filename}
                  </h4>
                  {doc.sourceType === 'artifact' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Generated
                    </span>
                  )}
                </div>

                {/* Edit Mode */}
                {editing === doc.id ? (
                  <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1">
                        <FolderKanban className="h-3 w-3" /> Project
                      </label>
                      <ProjectSelector
                        selectedProjectId={editProjectId}
                        onSelect={setEditProjectId}
                        allowAll={true}
                        allowCreate={true}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1">
                        <Tag className="h-3 w-3" /> Tags
                      </label>
                      <TagSelector
                        selectedTagIds={editTagIds}
                        onSelect={setEditTagIds}
                        allowCreate={true}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => saveEdits(doc.id)}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save & Re-index
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Project & Tags Row */}
                    <div className="mt-1 flex items-center flex-wrap gap-2">
                      {doc.projectName && (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: `${doc.projectColor}15`, color: doc.projectColor }}
                        >
                          <FolderKanban className="h-3 w-3" />
                          {doc.projectName}
                        </span>
                      )}
                      {doc.tags?.map(tag => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    {/* Metadata Row */}
                    <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Download className="h-3 w-3 mr-1" />
                        {formatFileSize(doc.fileSize)}
                      </span>
                      <span className="flex items-center">
                        <Layers className="h-3 w-3 mr-1" />
                        {doc.chunkCount} chunks
                      </span>
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(doc.uploadedAt)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            {editing !== doc.id && (
              <div className="flex items-center gap-1">
                <a
                  href={`/api/documents/download?id=${doc.id}`}
                  className="p-1.5 text-gray-400 hover:text-green-600 rounded transition-colors"
                  title="Download"
                  download
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => startEditing(doc)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id, doc.filename)}
                  disabled={deleting === doc.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50 rounded transition-colors"
                  title="Delete"
                >
                  {deleting === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
