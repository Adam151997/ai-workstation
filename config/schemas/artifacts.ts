// config/schemas/artifacts.ts
// Unified artifact type system for all generative artifacts

import { z } from 'zod';
import { LeadsSchema, LeadsArtifact } from './leads';

// ============================================
// Base Artifact Schema
// ============================================

export const BaseArtifactSchema = z.object({
    id: z.string(),
    type: z.enum(['document', 'table', 'chart', 'leads']),
    title: z.string(),
    description: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type BaseArtifact = z.infer<typeof BaseArtifactSchema>;

// ============================================
// Document Artifact
// ============================================

export const DocumentSectionSchema = z.object({
    heading: z.string(),
    level: z.number().min(1).max(6), // h1-h6
    content: z.string(),
    formatting: z.object({
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        alignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
    }).optional(),
});

export const DocumentArtifactSchema = BaseArtifactSchema.extend({
    type: z.literal('document'),
    sections: z.array(DocumentSectionSchema),
    style: z.object({
        font: z.string().optional(),
        fontSize: z.number().optional(),
        lineHeight: z.number().optional(),
        margins: z.object({
            top: z.number(),
            right: z.number(),
            bottom: z.number(),
            left: z.number(),
        }).optional(),
    }).optional(),
});

export type DocumentArtifact = z.infer<typeof DocumentArtifactSchema>;

// ============================================
// Table Artifact
// ============================================

export const TableColumnSchema = z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean', 'currency']),
    width: z.number().optional(),
    alignment: z.enum(['left', 'center', 'right']).optional(),
    sortable: z.boolean().optional(),
    format: z.string().optional(), // e.g., "currency:USD", "date:MM/DD/YYYY"
});

export const TableRowSchema = z.record(z.any()); // Dynamic keys based on columns

export const TableArtifactSchema = BaseArtifactSchema.extend({
    type: z.literal('table'),
    columns: z.array(TableColumnSchema),
    rows: z.array(TableRowSchema),
    summary: z.object({
        total_rows: z.number(),
        aggregations: z.record(z.any()).optional(), // e.g., { revenue: 50000 }
    }).optional(),
    style: z.object({
        striped: z.boolean().optional(),
        bordered: z.boolean().optional(),
        compact: z.boolean().optional(),
        hoverable: z.boolean().optional(),
    }).optional(),
});

export type TableArtifact = z.infer<typeof TableArtifactSchema>;

// ============================================
// Chart Artifact
// ============================================

export const ChartDataPointSchema = z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

export const ChartDatasetSchema = z.object({
    label: z.string(),
    data: z.array(z.number()),
    backgroundColor: z.string().optional(),
    borderColor: z.string().optional(),
    borderWidth: z.number().optional(),
});

export const ChartArtifactSchema = BaseArtifactSchema.extend({
    type: z.literal('chart'),
    chartType: z.enum(['line', 'bar', 'pie', 'doughnut', 'radar', 'scatter', 'area']),
    labels: z.array(z.string()),
    datasets: z.array(ChartDatasetSchema),
    options: z.object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        xAxisLabel: z.string().optional(),
        yAxisLabel: z.string().optional(),
        showLegend: z.boolean().optional(),
        showGrid: z.boolean().optional(),
        showTooltips: z.boolean().optional(),
        colors: z.array(z.string()).optional(),
    }).optional(),
});

export type ChartArtifact = z.infer<typeof ChartArtifactSchema>;

// ============================================
// Union Type for All Artifacts
// ============================================

export type Artifact = DocumentArtifact | TableArtifact | ChartArtifact | LeadsArtifact;

// Re-export for convenience
export { LeadsSchema };
export type { LeadsArtifact };

// ============================================
// Artifact Type Guards
// ============================================

export function isDocumentArtifact(artifact: Artifact): artifact is DocumentArtifact {
    return artifact.type === 'document';
}

export function isTableArtifact(artifact: Artifact): artifact is TableArtifact {
    return artifact.type === 'table';
}

export function isChartArtifact(artifact: Artifact): artifact is ChartArtifact {
    return artifact.type === 'chart';
}

export function isLeadsArtifact(artifact: Artifact): artifact is LeadsArtifact {
    return artifact.type === 'leads';
}

// ============================================
// Artifact Templates
// ============================================

export const ARTIFACT_TEMPLATES = {
    document: [
        {
            id: 'sales-proposal',
            name: 'Sales Proposal',
            description: 'Professional sales proposal template',
            icon: '📄',
        },
        {
            id: 'meeting-notes',
            name: 'Meeting Notes',
            description: 'Structured meeting notes template',
            icon: '📝',
        },
        {
            id: 'report',
            name: 'Business Report',
            description: 'Comprehensive business report template',
            icon: '📊',
        },
    ],
    table: [
        {
            id: 'contact-list',
            name: 'Contact List',
            description: 'Contact information table',
            icon: '👥',
        },
        {
            id: 'sales-report',
            name: 'Sales Report',
            description: 'Sales performance data table',
            icon: '💰',
        },
        {
            id: 'task-tracker',
            name: 'Task Tracker',
            description: 'Project task tracking table',
            icon: '✅',
        },
    ],
    chart: [
        {
            id: 'revenue-chart',
            name: 'Revenue Chart',
            description: 'Revenue trend visualization',
            icon: '📈',
        },
        {
            id: 'pie-chart',
            name: 'Distribution Chart',
            description: 'Data distribution pie chart',
            icon: '🥧',
        },
        {
            id: 'comparison-chart',
            name: 'Comparison Chart',
            description: 'Multi-metric comparison',
            icon: '📊',
        },
    ],
};

// ============================================
// Export Formats
// ============================================

export type ExportFormat = 'pdf' | 'docx' | 'csv' | 'xlsx' | 'json' | 'png' | 'svg';

export const EXPORT_FORMATS_BY_TYPE: Record<string, ExportFormat[]> = {
    document: ['pdf', 'docx', 'json'],
    table: ['csv', 'xlsx', 'json'],
    chart: ['png', 'svg', 'json'],
    leads: ['csv', 'xlsx', 'json'],
};
