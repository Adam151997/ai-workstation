// components/artifacts/ArtifactActions.tsx - Edit/Delete/Download controls for artifacts
'use client';

import { useState } from 'react';
import { Edit, Trash2, Download, Save, X } from 'lucide-react';

interface ArtifactActionsProps {
  documentId?: string;
  title: string;
  content: string;
  artifactType: 'document' | 'table' | 'chart';
  mode: string;
  onSave?: (documentId: string) => void;
  onDelete?: (documentId: string) => void;
}

export default function ArtifactActions({
  documentId,
  title,
  content,
  artifactType,
  mode,
  onSave,
  onDelete,
}: ArtifactActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/artifacts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: editedContent,
          artifactType,
          mode,
          artifactData: { title, content: editedContent, type: artifactType },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const data = await response.json();
      onSave?.(data.documentId);
      setIsEditing(false);
    } catch (error) {
      console.error('[ArtifactActions] Save error:', error);
      alert('Failed to save artifact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!documentId) return;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/documents?id=${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      onDelete?.(documentId);
    } catch (error) {
      console.error('[ArtifactActions] Delete error:', error);
      alert('Failed to delete artifact');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {!documentId ? (
          <>
            {/* Save (if not saved yet) */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              title="Save to library"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </>
        ) : (
          <>
            {/* Edit */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
              title="Edit artifact"
            >
              {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              <span>{isEditing ? 'Cancel' : 'Edit'}</span>
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 disabled:opacity-50"
              title="Delete artifact"
            >
              <Trash2 className="h-4 w-4" />
              <span>{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </>
        )}

        {/* Download */}
        <button
          onClick={handleDownload}
          className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200"
          title="Download artifact"
        >
          <Download className="h-4 w-4" />
          <span>Download</span>
        </button>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit: {title}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-auto">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-full min-h-[400px] p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Edit artifact content..."
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 p-4 border-t">
              <button
                onClick={() => {
                  setEditedContent(content);
                  setIsEditing(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
