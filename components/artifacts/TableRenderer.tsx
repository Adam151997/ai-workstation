// components/artifacts/TableRenderer.tsx - WITH ARTIFACT ACTIONS
'use client';

import { TableArtifact } from '@/config/schemas/artifacts';
import { FileDown, ArrowUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import ArtifactActions from './ArtifactActions';

interface TableRendererProps {
    artifact: TableArtifact;
    onExport?: (format: 'csv' | 'xlsx' | 'json') => void;
    mode?: string;
}

export function TableRenderer({ artifact, onExport, mode = 'Sales' }: TableRendererProps) {
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [documentId, setDocumentId] = useState<string | undefined>(undefined);

    const sortedRows = useMemo(() => {
        if (!sortColumn) return artifact.rows;

        return [...artifact.rows].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];

            if (aVal === bVal) return 0;

            const comparison = aVal > bVal ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [artifact.rows, sortColumn, sortDirection]);

    const handleSort = (columnKey: string) => {
        if (sortColumn === columnKey) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
    };

    const formatValue = (value: any, column: typeof artifact.columns[0]) => {
        if (value === null || value === undefined) return '-';

        switch (column.type) {
            case 'currency':
                const currency = column.format?.split(':')[1] || 'USD';
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency,
                }).format(value);
            case 'date':
                return new Date(value).toLocaleDateString();
            case 'number':
                return new Intl.NumberFormat('en-US').format(value);
            case 'boolean':
                return value ? '✓' : '✗';
            default:
                return String(value);
        }
    };

    const getAlignment = (column: typeof artifact.columns[0]) => {
        if (column.alignment) return column.alignment;
        if (column.type === 'number' || column.type === 'currency') return 'right';
        return 'left';
    };

    // Convert table to text
    const getArtifactContent = () => {
        return JSON.stringify({
            title: artifact.title,
            columns: artifact.columns,
            rows: artifact.rows,
        }, null, 2);
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
                                    onClick={() => onExport('csv')}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    CSV
                                </button>
                                <button
                                    onClick={() => onExport('xlsx')}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    XLSX
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
                    content={getArtifactContent()}
                    artifactType="table"
                    mode={mode}
                    onSave={(docId) => {
                        setDocumentId(docId);
                        console.log('[TableRenderer] Artifact saved:', docId);
                    }}
                    onDelete={(docId) => {
                        setDocumentId(undefined);
                        console.log('[TableRenderer] Artifact deleted:', docId);
                    }}
                />
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className={`w-full ${artifact.style?.striped ? 'table-striped' : ''}`}>
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr className={artifact.style?.bordered ? 'border-b' : ''}>
                            {artifact.columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={`px-4 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider ${artifact.style?.bordered ? 'border-r last:border-r-0' : ''
                                        }`}
                                    style={{
                                        textAlign: getAlignment(column),
                                        width: column.width ? `${column.width}px` : undefined,
                                    }}
                                >
                                    <div className="flex items-center gap-1 justify-between">
                                        <span>{column.label}</span>
                                        {column.sortable !== false && (
                                            <button
                                                onClick={() => handleSort(column.key)}
                                                className="hover:text-gray-900 transition-colors"
                                            >
                                                <ArrowUpDown className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedRows.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={`${artifact.style?.hoverable ? 'hover:bg-gray-50' : ''
                                    } ${artifact.style?.striped && rowIndex % 2 === 1 ? 'bg-gray-50' : ''
                                    }`}
                            >
                                {artifact.columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={`px-4 py-3 text-sm text-gray-900 ${artifact.style?.compact ? 'py-2' : ''
                                            } ${artifact.style?.bordered ? 'border-r last:border-r-0' : ''
                                            }`}
                                        style={{ textAlign: getAlignment(column) }}
                                    >
                                        {formatValue(row[column.key], column)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer with Summary */}
            <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                <span>
                    {artifact.summary?.total_rows || artifact.rows.length} rows × {artifact.columns.length} columns
                </span>
                {artifact.summary?.aggregations && (
                    <div className="flex gap-4">
                        {Object.entries(artifact.summary.aggregations).map(([key, value]) => (
                            <span key={key} className="font-medium">
                                {key}: {typeof value === 'number' ? value.toLocaleString() : value}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
