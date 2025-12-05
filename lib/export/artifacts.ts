// lib/export/artifacts.ts
// Export functionality for all artifact types

import { Artifact, isDocumentArtifact, isTableArtifact, isChartArtifact } from '@/config/schemas/artifacts';

// ============================================
// Document Export
// ============================================

export function exportDocumentAsText(artifact: Artifact): string {
    if (!isDocumentArtifact(artifact)) return '';
    
    return artifact.sections
        .map(section => `${'#'.repeat(section.level)} ${section.heading}\n\n${section.content}`)
        .join('\n\n');
}

export function exportDocumentAsJSON(artifact: Artifact): string {
    return JSON.stringify(artifact, null, 2);
}

export async function exportDocumentAsPDF(artifact: Artifact): Promise<void> {
    if (!isDocumentArtifact(artifact)) return;
    
    // For now, open print dialog (browser will handle PDF generation)
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${artifact.title}</title>
            <style>
                body {
                    font-family: 'Georgia', serif;
                    max-width: 800px;
                    margin: 40px auto;
                    padding: 20px;
                    line-height: 1.6;
                    color: #333;
                }
                h1 { font-size: 2em; margin-top: 0.67em; }
                h2 { font-size: 1.5em; margin-top: 0.83em; }
                h3 { font-size: 1.17em; margin-top: 1em; }
                h4 { font-size: 1em; margin-top: 1.33em; }
                h5 { font-size: 0.83em; margin-top: 1.67em; }
                h6 { font-size: 0.67em; margin-top: 2.33em; }
                p { margin: 1em 0; white-space: pre-wrap; }
                .metadata { color: #666; font-size: 0.9em; margin-bottom: 2em; }
            </style>
        </head>
        <body>
            <h1>${artifact.title}</h1>
            ${artifact.description ? `<p class="metadata">${artifact.description}</p>` : ''}
            ${artifact.sections.map(section => `
                <h${section.level}>${section.heading}</h${section.level}>
                <p>${section.content}</p>
            `).join('')}
            <p class="metadata">Generated on ${new Date(artifact.created_at).toLocaleString()}</p>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// ============================================
// Table Export
// ============================================

export function exportTableAsCSV(artifact: Artifact): string {
    if (!isTableArtifact(artifact)) return '';
    
    const headers = artifact.columns.map(col => col.label).join(',');
    const rows = artifact.rows.map(row => 
        artifact.columns.map(col => {
            const value = row[col.key];
            // Escape commas and quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
        }).join(',')
    );
    
    return [headers, ...rows].join('\n');
}

export function exportTableAsJSON(artifact: Artifact): string {
    if (!isTableArtifact(artifact)) return '';
    
    return JSON.stringify({
        title: artifact.title,
        description: artifact.description,
        columns: artifact.columns,
        rows: artifact.rows,
        summary: artifact.summary,
    }, null, 2);
}

export function downloadTableAsCSV(artifact: Artifact): void {
    const csv = exportTableAsCSV(artifact);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${artifact.title.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ============================================
// Chart Export
// ============================================

export function exportChartAsJSON(artifact: Artifact): string {
    if (!isChartArtifact(artifact)) return '';
    
    return JSON.stringify({
        title: artifact.title,
        description: artifact.description,
        chartType: artifact.chartType,
        labels: artifact.labels,
        datasets: artifact.datasets,
        options: artifact.options,
    }, null, 2);
}

// PNG export is handled directly in ChartRenderer component using canvas.toDataURL()

// ============================================
// Universal Export Handler
// ============================================

export async function exportArtifact(artifact: Artifact, format: string): Promise<void> {
    switch (format) {
        case 'pdf':
            if (isDocumentArtifact(artifact)) {
                await exportDocumentAsPDF(artifact);
            }
            break;
            
        case 'csv':
            if (isTableArtifact(artifact)) {
                downloadTableAsCSV(artifact);
            }
            break;
            
        case 'json':
            const json = exportDocumentAsJSON(artifact);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${artifact.title.replace(/\s+/g, '_')}.json`;
            link.click();
            URL.revokeObjectURL(url);
            break;
            
        default:
            console.warn(`Export format "${format}" not implemented for artifact type "${artifact.type}"`);
    }
}
