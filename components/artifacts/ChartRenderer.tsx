// components/artifacts/ChartRenderer.tsx
'use client';

import { ChartArtifact } from '@/config/schemas/artifacts';
import { FileDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ArtifactActions from './ArtifactActions';

interface ChartRendererProps {
    artifact: ChartArtifact;
    onExport?: (format: 'png' | 'svg' | 'json') => void;
    mode?: string;
}

export function ChartRenderer({ artifact, onExport, mode = 'Sales' }: ChartRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);
    const [documentId, setDocumentId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Dynamic import Chart.js
        import('chart.js/auto').then((ChartJS) => {
            const Chart = ChartJS.default;

            // Destroy previous chart instance
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }

            const ctx = canvasRef.current!.getContext('2d')!;

            // Create new chart
            chartInstanceRef.current = new Chart(ctx, {
                type: artifact.chartType as any,
                data: {
                    labels: artifact.labels,
                    datasets: artifact.datasets.map(dataset => ({
                        label: dataset.label,
                        data: dataset.data,
                        backgroundColor: dataset.backgroundColor || generateColors(dataset.data.length),
                        borderColor: dataset.borderColor,
                        borderWidth: dataset.borderWidth || 1,
                    })),
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: artifact.options?.showLegend !== false,
                            position: 'top',
                        },
                        title: {
                            display: !!artifact.options?.title,
                            text: artifact.options?.title || '',
                        },
                        tooltip: {
                            enabled: artifact.options?.showTooltips !== false,
                        },
                    },
                    scales: artifact.chartType !== 'pie' && artifact.chartType !== 'doughnut' ? {
                        x: {
                            title: {
                                display: !!artifact.options?.xAxisLabel,
                                text: artifact.options?.xAxisLabel || '',
                            },
                            grid: {
                                display: artifact.options?.showGrid !== false,
                            },
                        },
                        y: {
                            title: {
                                display: !!artifact.options?.yAxisLabel,
                                text: artifact.options?.yAxisLabel || '',
                            },
                            grid: {
                                display: artifact.options?.showGrid !== false,
                            },
                        },
                    } : undefined,
                },
            });
        });

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [artifact]);

    const generateColors = (count: number): string[] => {
        const colors = [
            'rgba(59, 130, 246, 0.8)',   // blue
            'rgba(34, 197, 94, 0.8)',    // green
            'rgba(249, 115, 22, 0.8)',   // orange
            'rgba(239, 68, 68, 0.8)',    // red
            'rgba(168, 85, 247, 0.8)',   // purple
            'rgba(236, 72, 153, 0.8)',   // pink
            'rgba(14, 165, 233, 0.8)',   // sky
            'rgba(250, 204, 21, 0.8)',   // yellow
        ];
        return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
    };

    const handleExportPNG = () => {
        if (!canvasRef.current) return;
        const url = canvasRef.current.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${artifact.title.replace(/\s+/g, '_')}.png`;
        link.href = url;
        link.click();
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
                    {onExport && (
                        <div className="relative group">
                            <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
                                <FileDown className="w-4 h-4" />
                                Export
                            </button>
                            <div className="absolute right-0 mt-1 w-32 bg-white border rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                <button
                                    onClick={handleExportPNG}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    PNG
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

                {/* Artifact Actions */}
                <ArtifactActions
                    documentId={documentId}
                    title={artifact.title}
                    content={JSON.stringify({
                        chartType: artifact.chartType,
                        labels: artifact.labels,
                        datasets: artifact.datasets,
                    }, null, 2)}
                    artifactType="chart"
                    mode={mode}
                    onSave={(docId) => {
                        setDocumentId(docId);
                        console.log('[ChartRenderer] Artifact saved:', docId);
                    }}
                    onDelete={(docId) => {
                        setDocumentId(undefined);
                        console.log('[ChartRenderer] Artifact deleted:', docId);
                    }}
                />
            </div>

            {/* Chart Canvas */}
            <div className="p-6">
                <div className="relative" style={{ height: '400px' }}>
                    <canvas ref={canvasRef} />
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                <span>
                    {artifact.chartType.charAt(0).toUpperCase() + artifact.chartType.slice(1)} Chart
                </span>
                <span>
                    {artifact.datasets.length} dataset{artifact.datasets.length !== 1 ? 's' : ''} • {artifact.labels.length} data points
                </span>
            </div>
        </div>
    );
}
