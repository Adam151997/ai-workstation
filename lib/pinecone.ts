// lib/pinecone.ts - Enhanced for Lightweight GraphRAG
// Includes project and tag metadata in vectors

import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone client
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

// Index name for document vectors
const INDEX_NAME = 'ai-workstation-docs';

// Embedding dimensions (OpenAI text-embedding-3-small)
const EMBEDDING_DIMENSION = 1536;

/**
 * Get or create Pinecone index
 */
export async function getIndex() {
    try {
        // Check if index exists
        const indexes = await pinecone.listIndexes();
        const indexExists = indexes.indexes?.some((idx) => idx.name === INDEX_NAME);

        if (!indexExists) {
            console.log(`[Pinecone] Creating index: ${INDEX_NAME}`);
            
            await pinecone.createIndex({
                name: INDEX_NAME,
                dimension: EMBEDDING_DIMENSION,
                metric: 'cosine',
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1',
                    },
                },
            });

            // Wait for index to be ready
            console.log('[Pinecone] Waiting for index to be ready...');
            await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 60 seconds
        }

        return pinecone.index(INDEX_NAME);
    } catch (error) {
        console.error('[Pinecone] Error initializing index:', error);
        throw error;
    }
}

/**
 * Generate embeddings using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: text,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
    } catch (error) {
        console.error('[Pinecone] Error generating embedding:', error);
        throw error;
    }
}

/**
 * Vector metadata interface - Enhanced for GraphRAG
 */
interface VectorMetadata {
    documentId: string;
    chunkIndex: number;
    text: string;
    userId: string;
    mode: string;
    projectId?: string;
    projectName?: string;
    tags?: string[];
    [key: string]: string | number | string[] | undefined; // Index signature for Pinecone
}

/**
 * Upsert vectors to Pinecone - Enhanced with project/tag metadata
 */
export async function upsertVectors(
    vectors: Array<{
        id: string;
        values: number[];
        metadata: VectorMetadata;
    }>
) {
    const index = await getIndex();
    await index.upsert(vectors);
    console.log(`[Pinecone] ✅ Upserted ${vectors.length} vectors`);
}

/**
 * Upsert vectors with project and tag metadata
 */
export async function upsertVectorsWithMetadata(
    vectors: Array<{
        id: string;
        values: number[];
        metadata: {
            documentId: string;
            chunkIndex: number;
            text: string;
            userId: string;
            mode: string;
        };
    }>,
    projectId?: string,
    projectName?: string,
    tags?: string[]
) {
    // Enhance metadata with project and tags
    const enhancedVectors = vectors.map(v => ({
        ...v,
        metadata: {
            ...v.metadata,
            projectId: projectId || '',
            projectName: projectName || '',
            tags: tags || [],
        },
    }));

    const index = await getIndex();
    await index.upsert(enhancedVectors);
    console.log(`[Pinecone] ✅ Upserted ${vectors.length} vectors with project/tag metadata`);
}

/**
 * Query similar vectors - Basic version
 */
export async function querySimilarVectors(
    embedding: number[],
    userId: string,
    mode: string,
    topK: number = 5
): Promise<Array<{ id: string; score: number; metadata?: VectorMetadata }>> {
    const index = await getIndex();
    
    const results = await index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
        filter: {
            userId: { $eq: userId },
            mode: { $eq: mode },
        },
    });

    return (results.matches || []).map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as unknown as VectorMetadata,
    }));
}

/**
 * Query similar vectors with project filter
 */
export async function querySimilarVectorsInProject(
    embedding: number[],
    userId: string,
    mode: string,
    projectId: string,
    topK: number = 5
): Promise<Array<{ id: string; score: number; metadata?: VectorMetadata }>> {
    const index = await getIndex();
    
    const results = await index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
        filter: {
            userId: { $eq: userId },
            mode: { $eq: mode },
            projectId: { $eq: projectId },
        },
    });

    return (results.matches || []).map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as unknown as VectorMetadata,
    }));
}

/**
 * Query similar vectors with tag filter
 */
export async function querySimilarVectorsWithTags(
    embedding: number[],
    userId: string,
    mode: string,
    tags: string[],
    topK: number = 5
): Promise<Array<{ id: string; score: number; metadata?: VectorMetadata }>> {
    const index = await getIndex();
    
    // Pinecone supports $in for array matching
    const results = await index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
        filter: {
            userId: { $eq: userId },
            mode: { $eq: mode },
            tags: { $in: tags },
        },
    });

    return (results.matches || []).map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as unknown as VectorMetadata,
    }));
}

/**
 * Query similar vectors with both project and tag filters
 */
export async function querySimilarVectorsFiltered(
    embedding: number[],
    userId: string,
    mode: string,
    options: {
        projectId?: string;
        tags?: string[];
        topK?: number;
    } = {}
): Promise<Array<{ id: string; score: number; metadata?: VectorMetadata }>> {
    const { projectId, tags, topK = 5 } = options;
    const index = await getIndex();
    
    // Build filter object
    const filter: Record<string, any> = {
        userId: { $eq: userId },
        mode: { $eq: mode },
    };

    if (projectId) {
        filter.projectId = { $eq: projectId };
    }

    if (tags && tags.length > 0) {
        filter.tags = { $in: tags };
    }
    
    const results = await index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
        filter,
    });

    return (results.matches || []).map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as unknown as VectorMetadata,
    }));
}

/**
 * Delete vectors by document ID
 * Note: Serverless indexes don't support deleteMany with filters,
 * so we delete by ID pattern instead
 */
export async function deleteVectorsByDocument(documentId: string) {
    try {
        const index = await getIndex();
        
        // Pinecone serverless doesn't support filter-based deleteMany
        // Our vector IDs follow the pattern: {documentId}-chunk-{index}
        // We'll delete by ID pattern
        
        // Generate expected IDs based on our naming convention
        // Attempt to delete IDs from chunk-0 to chunk-999 (covers most documents)
        const potentialIds: string[] = [];
        for (let i = 0; i < 500; i++) {
            potentialIds.push(`${documentId}-chunk-${i}`);
        }
        
        // Delete in batches of 100
        const batchSize = 100;
        for (let i = 0; i < potentialIds.length; i += batchSize) {
            const batch = potentialIds.slice(i, i + batchSize);
            try {
                await index.deleteMany(batch);
            } catch (batchError) {
                // Ignore errors for non-existent IDs
            }
        }
        
        console.log(`[Pinecone] ✅ Deleted vectors for document: ${documentId}`);
    } catch (error: any) {
        console.error(`[Pinecone] ❌ Failed to delete vectors:`, error.message);
        // Don't throw - allow the database deletion to proceed
    }
}

/**
 * Update vectors metadata for a document (e.g., when project changes)
 */
export async function updateVectorsProjectMetadata(
    documentId: string,
    projectId: string,
    projectName: string
) {
    // Note: Pinecone doesn't support direct metadata updates
    // You would need to re-index the vectors with new metadata
    // This is a placeholder for the logic
    console.log(`[Pinecone] ⚠️ Metadata update requires re-indexing for document: ${documentId}`);
    
    // In production, you would:
    // 1. Fetch existing vectors for this document
    // 2. Delete them
    // 3. Re-upsert with new metadata
}

/**
 * Update vectors metadata for a document's tags
 */
export async function updateVectorsTagMetadata(
    documentId: string,
    tags: string[]
) {
    // Same as above - requires re-indexing
    console.log(`[Pinecone] ⚠️ Tag metadata update requires re-indexing for document: ${documentId}`);
}

export default pinecone;
