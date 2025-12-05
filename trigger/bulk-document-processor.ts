// trigger/bulk-document-processor.ts
// Background job for processing multiple documents
// Uses HTTP calls to Next.js API (no direct library imports)

import { task, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const BulkDocumentPayload = z.object({
    jobId: z.string().uuid(),
    userId: z.string(),
    mode: z.enum(["Sales", "Marketing", "Admin"]),
    projectId: z.string().uuid().optional(),
    documents: z.array(z.object({
        documentId: z.string().uuid(),
        filename: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
    })),
    options: z.object({
        generateEmbeddings: z.boolean().default(true),
        extractMetadata: z.boolean().default(true),
        chunkSize: z.number().default(1000),
        chunkOverlap: z.number().default(200),
    }).optional(),
});

export type BulkDocumentPayload = z.infer<typeof BulkDocumentPayload>;

// Helper to get base URL
function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
}

// Helper to make API calls
async function apiCall(endpoint: string, body: Record<string, any>): Promise<any> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-trigger-secret': process.env.TRIGGER_SECRET_KEY || '',
        },
        body: JSON.stringify(body),
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API call failed: ${response.status} - ${error}`);
    }
    
    return response.json();
}

export const processBulkDocuments = task({
    id: "process-bulk-documents",
    maxDuration: 7200,
    retry: {
        maxAttempts: 2,
        minTimeoutInMs: 5000,
        maxTimeoutInMs: 60000,
        factor: 2,
    },
    run: async (payload: BulkDocumentPayload) => {
        const { jobId, userId, mode, projectId, documents, options } = payload;

        logger.info("Starting bulk document processing", { 
            jobId, 
            documentCount: documents.length, 
            userId,
            baseUrl: getBaseUrl(),
        });

        const results: Array<{
            documentId: string;
            filename: string;
            success: boolean;
            chunksCreated?: number;
            error?: string;
        }> = [];

        let processedCount = 0;
        let failedCount = 0;

        for (const doc of documents) {
            logger.info(`Processing ${processedCount + failedCount + 1}/${documents.length}`, { 
                filename: doc.filename 
            });

            try {
                // Call API endpoint to process single document
                const result = await apiCall('/api/documents/process-single', {
                    documentId: doc.documentId,
                    userId,
                    mode,
                    projectId,
                    options,
                });

                processedCount++;
                results.push({
                    documentId: doc.documentId,
                    filename: doc.filename,
                    success: true,
                    chunksCreated: result.chunksCreated,
                });
                
                logger.info(`Success: ${doc.filename}`, { chunks: result.chunksCreated });
            } catch (error: any) {
                logger.error(`Failed: ${doc.filename}`, { error: error.message });
                failedCount++;
                results.push({ 
                    documentId: doc.documentId, 
                    filename: doc.filename, 
                    success: false, 
                    error: error.message 
                });
            }

            // Update progress via API
            try {
                await apiCall('/api/jobs/update-progress', {
                    jobId,
                    userId,
                    processed: processedCount,
                    failed: failedCount,
                    total: documents.length,
                });
            } catch (e) {
                // Non-critical, continue
            }
        }

        const finalStatus = failedCount === 0 ? "success" : processedCount === 0 ? "failed" : "partial";

        logger.info("Bulk processing completed", { status: finalStatus, processedCount, failedCount });

        return {
            jobId,
            status: finalStatus,
            results,
            summary: { 
                totalDocuments: documents.length, 
                processedCount, 
                failedCount,
            },
        };
    },
});
