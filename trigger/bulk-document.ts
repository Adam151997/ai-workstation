// trigger/bulk-document.ts
// Background job for bulk document processing
// Handles large-scale document ingestion without timeouts

import { task, wait } from "@trigger.dev/sdk/v3";
import { BulkDocumentJobPayload } from "./client";

/**
 * Bulk Document Processing Job
 * 
 * Processes multiple documents in the background:
 * - Extract text from PDFs, DOCX, etc.
 * - Generate embeddings
 * - Store in Pinecone
 * - Update PostgreSQL
 */
export const bulkDocumentProcessingJob = task({
    id: "bulk-document-processing",
    retry: {
        maxAttempts: 3,
        minTimeoutInMs: 2000,
        maxTimeoutInMs: 30000,
        factor: 2,
    },
    machine: {
        preset: "medium-1x", // More resources for document processing
    },
    run: async (payload: BulkDocumentJobPayload, { ctx }) => {
        const { documents, projectId, tags, metadata } = payload;
        
        console.log(`[Bulk Doc Job] 🚀 Starting bulk processing`);
        console.log(`[Bulk Doc Job] Documents: ${documents.length}`);
        console.log(`[Bulk Doc Job] User: ${metadata.userId}, Mode: ${metadata.mode}`);

        const results: Array<{
            documentId: string;
            filename: string;
            status: 'success' | 'failed' | 'skipped';
            chunksCreated?: number;
            error?: string;
            duration: number;
        }> = [];

        let totalChunks = 0;
        let processedSize = 0;

        // Process documents in batches to manage memory
        const batchSize = 5;
        for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            
            console.log(`[Bulk Doc Job] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);

            // Process batch in parallel
            const batchResults = await Promise.allSettled(
                batch.map(doc => processDocument(doc, projectId, tags, metadata))
            );

            // Collect results
            for (let j = 0; j < batchResults.length; j++) {
                const doc = batch[j];
                const result = batchResults[j];

                if (result.status === 'fulfilled') {
                    results.push({
                        documentId: doc.id,
                        filename: doc.filename,
                        status: 'success',
                        chunksCreated: result.value.chunksCreated,
                        duration: result.value.duration,
                    });
                    totalChunks += result.value.chunksCreated;
                    processedSize += doc.fileSize;
                    
                    console.log(`[Bulk Doc Job] ✅ ${doc.filename} (${result.value.chunksCreated} chunks)`);
                } else {
                    results.push({
                        documentId: doc.id,
                        filename: doc.filename,
                        status: 'failed',
                        error: result.reason?.message || 'Unknown error',
                        duration: 0,
                    });
                    
                    console.error(`[Bulk Doc Job] ❌ ${doc.filename}: ${result.reason?.message}`);
                }
            }

            // Update progress
            await updateBulkProgress(metadata.userId, {
                totalDocuments: documents.length,
                processedDocuments: results.length,
                totalChunks,
                processedSize,
            });

            // Small delay between batches
            if (i + batchSize < documents.length) {
                await wait.for({ seconds: 2 });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const failedCount = results.filter(r => r.status === 'failed').length;

        console.log(`[Bulk Doc Job] 🏁 Completed: ${successCount} success, ${failedCount} failed`);
        console.log(`[Bulk Doc Job] Total chunks: ${totalChunks}, Size: ${formatBytes(processedSize)}`);

        return {
            status: failedCount === 0 ? 'success' : failedCount === documents.length ? 'failed' : 'partial',
            results,
            summary: {
                totalDocuments: documents.length,
                successfulDocuments: successCount,
                failedDocuments: failedCount,
                totalChunks,
                totalSize: processedSize,
            },
        };
    },
});

/**
 * Process a single document
 */
async function processDocument(
    doc: { id: string; filename: string; fileType: string; fileSize: number },
    projectId: string | undefined,
    tags: string[] | undefined,
    metadata: { userId: string; mode: string }
): Promise<{ chunksCreated: number; duration: number }> {
    const startTime = Date.now();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/documents/process`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-trigger': 'true',
        },
        body: JSON.stringify({
            documentId: doc.id,
            projectId,
            tags,
            userId: metadata.userId,
            mode: metadata.mode,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Processing failed: ${error}`);
    }

    const result = await response.json();
    
    return {
        chunksCreated: result.chunksCreated || 0,
        duration: Date.now() - startTime,
    };
}

/**
 * Update bulk processing progress
 */
async function updateBulkProgress(
    userId: string,
    progress: {
        totalDocuments: number;
        processedDocuments: number;
        totalChunks: number;
        processedSize: number;
    }
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    await fetch(`${baseUrl}/api/documents/bulk-progress`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-trigger': 'true',
        },
        body: JSON.stringify({
            userId,
            ...progress,
        }),
    });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Document Reprocessing Job
 * Re-index documents with updated settings (e.g., new chunk size)
 */
export const documentReprocessingJob = task({
    id: "document-reprocessing",
    retry: {
        maxAttempts: 2,
    },
    run: async (payload: {
        documentIds: string[];
        newChunkSize?: number;
        newOverlap?: number;
        metadata: { userId: string; mode: string };
    }) => {
        const { documentIds, newChunkSize, newOverlap, metadata } = payload;
        
        console.log(`[Reprocess Job] 🔄 Reprocessing ${documentIds.length} documents`);
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const results = [];

        for (const docId of documentIds) {
            try {
                const response = await fetch(`${baseUrl}/api/documents/reprocess`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-internal-trigger': 'true',
                    },
                    body: JSON.stringify({
                        documentId: docId,
                        chunkSize: newChunkSize,
                        overlap: newOverlap,
                        userId: metadata.userId,
                        mode: metadata.mode,
                    }),
                });

                if (response.ok) {
                    const result = await response.json();
                    results.push({ documentId: docId, status: 'success', ...result });
                } else {
                    results.push({ documentId: docId, status: 'failed', error: await response.text() });
                }
            } catch (error: any) {
                results.push({ documentId: docId, status: 'failed', error: error.message });
            }

            // Delay between documents
            await wait.for({ seconds: 1 });
        }

        return {
            totalDocuments: documentIds.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'failed').length,
            results,
        };
    },
});
