// components/documents/DocumentUpload.tsx - Enhanced with Project & Tag Selectors
'use client';

import { useState, useCallback } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, FolderKanban, Tags } from 'lucide-react';
import { ProjectSelector } from '@/components/projects/ProjectSelector';
import { TagSelector } from '@/components/projects/TagSelector';

interface DocumentUploadProps {
  mode: string;
  onUploadComplete?: () => void;
}

export default function DocumentUpload({ mode, onUploadComplete }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Project & Tag selection
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];
    const validExtensions = ['.pdf', '.docx', '.txt', '.md'];
    
    const isValidType = validTypes.includes(file.type) || 
                       validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType) {
      setError('Invalid file type. Please upload PDF, DOCX, TXT, or MD files.');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccess(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mode', mode);
      
      // Add project and tags if selected
      if (selectedProjectId) {
        formData.append('projectId', selectedProjectId);
      }
      if (selectedTagIds.length > 0) {
        formData.append('tagIds', selectedTagIds.join(','));
      }

      // Simulate progress (actual upload happens in one go)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      console.log('[Upload] Success:', data);

      setSuccess(true);
      setSelectedFile(null);
      setSelectedProjectId(undefined);
      setSelectedTagIds([]);
      
      // Call callback after brief delay
      setTimeout(() => {
        onUploadComplete?.();
        setSuccess(false);
        setProgress(0);
      }, 2000);

    } catch (err: any) {
      console.error('[Upload] Error:', err);
      setError(err.message || 'Failed to upload document');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    setSuccess(false);
    setProgress(0);
  };

  return (
    <div className="w-full space-y-4">
      {/* Project & Tag Selectors - Always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <FolderKanban className="w-4 h-4" />
            Project
          </label>
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onSelect={setSelectedProjectId}
            allowAll={true}
            allowCreate={true}
          />
          <p className="mt-1 text-xs text-gray-500">
            Organize documents by project for better RAG filtering
          </p>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Tags className="w-4 h-4" />
            Tags
          </label>
          <TagSelector
            selectedTagIds={selectedTagIds}
            onSelect={setSelectedTagIds}
            allowCreate={true}
          />
          <p className="mt-1 text-xs text-gray-500">
            Add tags like "urgent", "contract", "review"
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${selectedFile ? 'bg-gray-50' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!selectedFile ? (
          <>
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop a file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Supported: PDF, DOCX, TXT, MD (max 10MB)
            </p>
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileInputChange}
              disabled={uploading}
            />
          </>
        ) : (
          <div className="space-y-4">
            {/* Selected File */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-3">
                <File className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {!uploading && !success && (
                <button
                  onClick={handleRemoveFile}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Upload Metadata Summary */}
            {!uploading && !success && (selectedProjectId || selectedTagIds.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                {selectedProjectId && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    📁 Project assigned
                  </span>
                )}
                {selectedTagIds.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">
                    🏷️ {selectedTagIds.length} tag{selectedTagIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Progress Bar */}
            {uploading && (
              <div className="w-full">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Uploading & Processing...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Extracting text, generating embeddings...
                </p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-center justify-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Upload successful! Document indexed.</span>
              </div>
            )}

            {/* Upload Button */}
            {!uploading && !success && (
              <button
                onClick={handleUpload}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Upload & Index Document
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}
