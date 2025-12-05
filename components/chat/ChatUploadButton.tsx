// components/chat/ChatUploadButton.tsx - FIXED: Close button now works
'use client';

import { useState, useRef } from 'react';
import { Paperclip, X, Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface ChatUploadButtonProps {
  mode: string;
  onUploadComplete?: () => void;
}

export default function ChatUploadButton({ mode, onUploadComplete }: ChatUploadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (uploading) return; // Don't close while uploading
    setIsOpen(false);
    setSelectedFile(null);
    setError(null);
    setSuccess(false);
    setProgress(0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Validate
      const validExtensions = ['.pdf', '.docx', '.txt', '.md'];
      const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!isValid) {
        setError('Invalid file type. Please upload PDF, DOCX, TXT, or MD files.');
        return;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('File too large. Maximum size is 10MB.');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mode', mode);

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

      setSuccess(true);
      
      setTimeout(() => {
        handleClose();
        onUploadComplete?.();
      }, 2000);

    } catch (err: any) {
      console.error('[ChatUpload] Error:', err);
      setError(err.message || 'Failed to upload document');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Upload Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        title="Upload document"
      >
        <Paperclip className="h-5 w-5" />
      </button>

      {/* Upload Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            // Close if clicking backdrop
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload Document
              </h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={uploading ? "Please wait for upload to complete" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {!selectedFile ? (
                <>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center relative">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Click to select a file
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      PDF, DOCX, TXT, MD (max 10MB)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={handleFileSelect}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Document will be processed for AI retrieval
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Selected File */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  {/* Progress */}
                  {uploading && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Processing...</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Success */}
                  {success && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Upload successful!</span>
                    </div>
                  )}

                  {/* Buttons */}
                  {!uploading && !success && (
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setError(null);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleUpload}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Upload
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
