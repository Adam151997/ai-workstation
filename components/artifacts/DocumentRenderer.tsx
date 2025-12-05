// components/artifacts/DocumentRenderer.tsx - WITH ARTIFACT ACTIONS
'use client';

import { DocumentArtifact } from '@/config/schemas/artifacts';
import { FileDown, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import ArtifactActions from './ArtifactActions';

interface DocumentRendererProps {
    artifact: DocumentArtifact;
    onExport?: (format: 'pdf' | 'docx' | 'json') => void;
    mode?: string;
}

export function DocumentRenderer({ artifact, onExport, mode = 'Sales' }: DocumentRendererProps) {
    const [copied, setCopied] = useState(false);
    const [documentId, setDocumentId] = useState<string | undefined>(undefined);

    const handleCopy = () => {
        const text = artifact.sections.map(s => `${s.heading}\n\n${s.content}`).join('\n\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getHeadingClass = (level: number) => {
        const sizes = {
            1: 'text-3xl font-bold',
            2: 'text-2xl font-bold',
            3: 'text-xl font-semibold',
            4: 'text-lg font-semibold',
            5: 'text-base font-semibold',
            6: 'text-sm font-semibold',
        };
        return sizes[level as keyof typeof sizes] || sizes[1];
    };

    // Convert artifact to plain text
    const getArtifactContent = () => {
        return artifact.sections.map(s => `${s.heading}\n\n${s.content}`).join('\n\n');
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border">
            {/* Header */}
            <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            {artifact.title}
                        </h3>
                        {artifact.description && (
                            <p className="text-sm text-gray-600 mt-1">
                                {artifact.description}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="p-2 hover:bg-gray-200 rounded transition-colors"
                            title="Copy to clipboard"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-green-600" />
                            ) : (
                                <Copy className="w-4 h-4 text-gray-600" />
                            )}
                        </button>
                        {onExport && (
                            <div className="relative group">
                                <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
                                    <FileDown className="w-4 h-4" />
                                    Export
                                </button>
                                <div className="absolute right-0 mt-1 w-32 bg-white border rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                    <button
                                        onClick={() => onExport('pdf')}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        PDF
                                    </button>
                                    <button
                                        onClick={() => onExport('docx')}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        DOCX
                                    </button>
                                    <button
                                        onClick={() => onExport('json')}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        JSON
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Artifact Actions */}
                <ArtifactActions
                    documentId={documentId}
                    title={artifact.title}
                    content={getArtifactContent()}
                    artifactType="document"
                    mode={mode}
                    onSave={(docId) => {
                        setDocumentId(docId);
                        console.log('[DocumentRenderer] Artifact saved:', docId);
                    }}
                    onDelete={(docId) => {
                        setDocumentId(undefined);
                        console.log('[DocumentRenderer] Artifact deleted:', docId);
                    }}
                />
            </div>

            {/* Document Content */}
            <div className="p-8 max-h-[600px] overflow-y-auto">
                <div className="max-w-3xl mx-auto space-y-6">
                    {artifact.sections.map((section, index) => (
                        <div key={index} className="space-y-3">
                            <h2
                                className={`${getHeadingClass(section.level)} text-gray-900`}
                                style={{
                                    textAlign: section.formatting?.alignment || 'left',
                                    fontWeight: section.formatting?.bold ? 'bold' : undefined,
                                    fontStyle: section.formatting?.italic ? 'italic' : undefined,
                                }}
                            >
                                {section.heading}
                            </h2>
                            <p
                                className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                                style={{
                                    textAlign: section.formatting?.alignment || 'left',
                                }}
                            >
                                {section.content}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                <span>Created: {new Date(artifact.created_at).toLocaleString()}</span>
                <span>{artifact.sections.length} sections</span>
            </div>
        </div>
    );
}
