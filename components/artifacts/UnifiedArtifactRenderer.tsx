// components/artifacts/UnifiedArtifactRenderer.tsx - WITH MODE PROP
'use client';

import { Artifact, isDocumentArtifact, isTableArtifact, isChartArtifact, isLeadsArtifact } from '@/config/schemas/artifacts';
import { DocumentRenderer } from './DocumentRenderer';
import { TableRenderer } from './TableRenderer';
import { ChartRenderer } from './ChartRenderer';
import { FileText, Table2, BarChart3, Users, Loader2 } from 'lucide-react';

interface UnifiedArtifactRendererProps {
    artifact: Artifact | null;
    status: 'idle' | 'running' | 'complete' | 'error';
    onExport?: (format: string) => void;
    mode?: string;
}

export function UnifiedArtifactRenderer({ artifact, status, onExport, mode = 'Sales' }: UnifiedArtifactRendererProps) {
    // Empty state
    if (!artifact && status === 'idle') {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center p-8">
                    <div className="flex justify-center gap-4 mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                        <Table2 className="w-8 h-8 text-gray-400" />
                        <BarChart3 className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No Artifact Yet
                    </h3>
                    <p className="text-sm text-gray-600 max-w-sm">
                        Start a conversation to generate documents, tables, charts, and more.
                    </p>
                </div>
            </div>
        );
    }

    // Loading state
    if (status === 'running') {
        return (
            <div className="h-full flex items-center justify-center bg-white rounded-lg border">
                <div className="text-center p-8">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Generating Artifact...
                    </h3>
                    <p className="text-sm text-gray-600">
                        {artifact ? `Creating ${artifact.type}...` : 'Processing your request...'}
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (status === 'error') {
        return (
            <div className="h-full flex items-center justify-center bg-red-50 rounded-lg border border-red-200">
                <div className="text-center p-8">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">⚠️</span>
                    </div>
                    <h3 className="text-lg font-medium text-red-900 mb-2">
                        Generation Failed
                    </h3>
                    <p className="text-sm text-red-700">
                        Something went wrong while generating the artifact. Please try again.
                    </p>
                </div>
            </div>
        );
    }

    // Render artifact based on type
    if (!artifact) return null;

    if (isDocumentArtifact(artifact)) {
        return <DocumentRenderer artifact={artifact} onExport={onExport as any} mode={mode} />;
    }

    if (isTableArtifact(artifact)) {
        return <TableRenderer artifact={artifact} onExport={onExport as any} mode={mode} />;
    }

    if (isChartArtifact(artifact)) {
        return <ChartRenderer artifact={artifact} onExport={onExport as any} mode={mode} />;
    }

    if (isLeadsArtifact(artifact)) {
        // Legacy leads artifact rendering
        return (
            <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-900">
                            {artifact.title}
                        </h3>
                    </div>
                </div>
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                    {artifact.leads.map((lead, index) => (
                        <div key={index} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                            <h4 className="font-semibold text-gray-900">{lead.name}</h4>
                            <p className="text-sm text-gray-600">{lead.company}</p>
                            <div className="mt-2 flex gap-2 text-xs">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                    {lead.industry}
                                </span>
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                                    Score: {lead.score}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}
