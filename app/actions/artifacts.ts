// app/actions/artifacts.ts
'use server';

import { streamObject } from 'ai';
import { createStreamableValue } from '@ai-sdk/rsc';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// ============================================
// Simplified Schemas for Streaming
// ============================================

const DocumentSectionSchema = z.object({
    heading: z.string(),
    level: z.number().min(1).max(6),
    content: z.string(),
});

const SimpleDocumentSchema = z.object({
    id: z.string(),
    type: z.literal('document'),
    title: z.string(),
    description: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    sections: z.array(DocumentSectionSchema),
});

const TableColumnSchema = z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean', 'currency']),
});

const SimpleTableSchema = z.object({
    id: z.string(),
    type: z.literal('table'),
    title: z.string(),
    description: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    columns: z.array(TableColumnSchema),
    rows: z.array(z.record(z.any())),
});

const ChartDatasetSchema = z.object({
    label: z.string(),
    data: z.array(z.number()),
    backgroundColor: z.string().optional(),
});

const SimpleChartSchema = z.object({
    id: z.string(),
    type: z.literal('chart'),
    title: z.string(),
    description: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    chartType: z.enum(['line', 'bar', 'pie', 'doughnut', 'radar', 'scatter', 'area']),
    labels: z.array(z.string()),
    datasets: z.array(ChartDatasetSchema),
});

// ============================================
// Generate Document Artifact
// ============================================

export async function generateDocumentArtifact(prompt: string) {
    const stream = createStreamableValue();

    (async () => {
        try {
            const { partialObjectStream } = await streamObject({
                model: openai('gpt-4o-mini'),
                schema: SimpleDocumentSchema,
                system: `You are an expert document writer. Create professional, well-structured documents.

Guidelines:
- Use clear, concise language
- Organize content with appropriate heading levels (1-6)
- Include 3-5 sections minimum
- Make content actionable and informative
- Ensure professional tone`,
                prompt: `Create a document based on this request: ${prompt}

Current timestamp: ${new Date().toISOString()}

Generate a complete document with:
1. Unique ID (use: doc_${Date.now()})
2. Appropriate title
3. Clear description
4. Multiple well-organized sections (3-5 sections)
5. Set type to "document"
6. Set created_at and updated_at to current timestamp`,
            });

            for await (const partialObject of partialObjectStream) {
                stream.update(partialObject);
            }

            stream.done();
        } catch (error) {
            console.error('[Artifact] Document generation error:', error);
            stream.error(error);
        }
    })();

    return { object: stream.value };
}

// ============================================
// Generate Table Artifact
// ============================================

export async function generateTableArtifact(prompt: string) {
    const stream = createStreamableValue();

    (async () => {
        try {
            const { partialObjectStream } = await streamObject({
                model: openai('gpt-4o-mini'),
                schema: SimpleTableSchema,
                system: `You are a data analyst. Create well-structured, informative data tables.

Guidelines:
- Define clear column types (string, number, date, boolean, currency)
- Include 5-20 rows of realistic data
- Use proper column keys (lowercase, underscore-separated)
- Make data relevant and realistic`,
                prompt: `Create a data table based on this request: ${prompt}

Current timestamp: ${new Date().toISOString()}

Generate a complete table with:
1. Unique ID (use: table_${Date.now()})
2. Clear title and description
3. Well-defined columns with appropriate types
4. Realistic sample data (5-20 rows)
5. Set type to "table"
6. Set created_at and updated_at to current timestamp`,
            });

            for await (const partialObject of partialObjectStream) {
                stream.update(partialObject);
            }

            stream.done();
        } catch (error) {
            console.error('[Artifact] Table generation error:', error);
            stream.error(error);
        }
    })();

    return { object: stream.value };
}

// ============================================
// Generate Chart Artifact
// ============================================

export async function generateChartArtifact(prompt: string) {
    const stream = createStreamableValue();

    (async () => {
        try {
            const { partialObjectStream } = await streamObject({
                model: openai('gpt-4o-mini'),
                schema: SimpleChartSchema,
                system: `You are a data visualization expert. Create clear, insightful charts.

Guidelines:
- Choose the most appropriate chart type for the data
- Use 5-12 data points for clarity
- Include clear labels
- Use realistic data values

Chart types:
- line: trends over time
- bar: comparisons between categories
- pie/doughnut: part-to-whole relationships
- radar: multi-dimensional comparisons
- scatter: correlations
- area: cumulative trends`,
                prompt: `Create a chart based on this request: ${prompt}

Current timestamp: ${new Date().toISOString()}

Generate a complete chart with:
1. Unique ID (use: chart_${Date.now()})
2. Appropriate chart type for the data
3. Clear title and description
4. Well-labeled data (5-12 data points)
5. At least one dataset with realistic values
6. Set type to "chart"
7. Set created_at and updated_at to current timestamp`,
            });

            for await (const partialObject of partialObjectStream) {
                stream.update(partialObject);
            }

            stream.done();
        } catch (error) {
            console.error('[Artifact] Chart generation error:', error);
            stream.error(error);
        }
    })();

    return { object: stream.value };
}

// ============================================
// Smart Artifact Generator (Auto-detect type)
// ============================================

export async function generateSmartArtifact(prompt: string) {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('chart') || promptLower.includes('graph') || 
        promptLower.includes('visuali') || promptLower.includes('plot')) {
        return generateChartArtifact(prompt);
    }
    
    if (promptLower.includes('table') || promptLower.includes('list') || 
        promptLower.includes('data') || promptLower.includes('spreadsheet')) {
        return generateTableArtifact(prompt);
    }
    
    // Default to document
    return generateDocumentArtifact(prompt);
}
