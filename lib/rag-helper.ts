// lib/rag-helper.ts - Enhanced for Lightweight GraphRAG
// Supports project and tag-based document filtering

import { generateEmbedding, querySimilarVectors } from './pinecone';
import { query } from './db';

interface RAGContext {
    hasContext: boolean;
    context: string;
    sources: Array<{
        filename: string;
        chunkIndex: number;
        relevanceScore: number;
        projectName?: string;
        tags?: string[];
    }>;
}

interface RAGOptions {
    topK?: number;
    projectId?: string;
    projectName?: string;
    tagIds?: string[];
    tagNames?: string[];
    minRelevanceScore?: number;
}

/**
 * Get relevant context from documents for a user query
 * Enhanced with project and tag filtering (Lightweight GraphRAG)
 */
export async function getRAGContext(
    userQuery: string,
    userId: string,
    mode: string,
    options: RAGOptions = {}
): Promise<RAGContext> {
    const {
        topK = 5,
        projectId,
        projectName,
        tagIds,
        tagNames,
        minRelevanceScore = 0.5,
    } = options;

    try {
        console.log(`[RAG Helper] Querying for: "${userQuery.substring(0, 50)}..."`);
        console.log(`[RAG Helper] Filters: project=${projectId || projectName || 'none'}, tags=${tagNames?.join(',') || 'none'}`);

        // 1. Resolve project ID if name provided
        let resolvedProjectId = projectId;
        if (!resolvedProjectId && projectName) {
            const projectResult = await query(
                `SELECT id FROM projects WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
                [userId, projectName]
            );
            if (projectResult.length > 0) {
                resolvedProjectId = projectResult[0].id;
            }
        }

        // 2. Resolve tag IDs if names provided
        let resolvedTagIds = tagIds || [];
        if (tagNames && tagNames.length > 0) {
            const tagResult = await query(
                `SELECT id FROM tags WHERE user_id = $1 AND LOWER(name) = ANY($2)`,
                [userId, tagNames.map(t => t.toLowerCase())]
            );
            resolvedTagIds = [...resolvedTagIds, ...tagResult.map((t: any) => t.id)];
        }

        // 3. Generate embedding for query
        const queryEmbedding = await generateEmbedding(userQuery);

        // 4. Build filter for pre-filtering documents
        let documentIds: string[] | null = null;

        if (resolvedProjectId || resolvedTagIds.length > 0) {
            // Get document IDs that match filters
            let filterSql = `
                SELECT DISTINCT d.id
                FROM documents d
                WHERE d.user_id = $1 AND d.mode = $2
            `;
            const params: any[] = [userId, mode];
            let paramIndex = 3;

            if (resolvedProjectId) {
                filterSql += ` AND d.project_id = $${paramIndex++}`;
                params.push(resolvedProjectId);
            }

            if (resolvedTagIds.length > 0) {
                filterSql += ` AND d.id IN (
                    SELECT dt.document_id FROM document_tags dt 
                    WHERE dt.tag_id = ANY($${paramIndex++})
                )`;
                params.push(resolvedTagIds);
            }

            const filteredDocs = await query(filterSql, params);
            documentIds = filteredDocs.map((d: any) => d.id);

            console.log(`[RAG Helper] Pre-filtered to ${documentIds.length} documents`);

            if (documentIds.length === 0) {
                console.log('[RAG Helper] No documents match filters');
                return {
                    hasContext: false,
                    context: '',
                    sources: [],
                };
            }
        }

        // 5. Search similar vectors (with optional document ID filter)
        const matches = await querySimilarVectorsWithFilter(
            queryEmbedding,
            userId,
            mode,
            topK * 2, // Fetch more to allow for score filtering
            documentIds
        );

        if (matches.length === 0) {
            console.log('[RAG Helper] No relevant documents found');
            return {
                hasContext: false,
                context: '',
                sources: [],
            };
        }

        // 6. Filter by minimum relevance score
        const relevantMatches = matches.filter(m => m.score >= minRelevanceScore);
        
        if (relevantMatches.length === 0) {
            console.log(`[RAG Helper] No matches above relevance threshold (${minRelevanceScore})`);
            return {
                hasContext: false,
                context: '',
                sources: [],
            };
        }

        // Take top K after filtering
        const topMatches = relevantMatches.slice(0, topK);

        console.log(`[RAG Helper] Found ${topMatches.length} relevant chunks (score >= ${minRelevanceScore})`);

        // 7. Get chunk details with project and tag info
        const chunkIds = topMatches.map((m) => m.id);
        const chunks = await query(
            `SELECT 
                dc.chunk_text,
                dc.chunk_index,
                dc.pinecone_id,
                d.filename,
                d.project_id,
                p.name as project_name,
                p.color as project_color,
                COALESCE(
                    (SELECT json_agg(json_build_object('name', t.name, 'color', t.color))
                     FROM document_tags dt
                     JOIN tags t ON dt.tag_id = t.id
                     WHERE dt.document_id = d.id),
                    '[]'::json
                ) as tags
             FROM document_chunks dc
             JOIN documents d ON dc.document_id = d.id
             LEFT JOIN projects p ON d.project_id = p.id
             WHERE dc.pinecone_id = ANY($1)`,
            [chunkIds]
        );

        // 8. Build context with metadata
        const contextParts = chunks.map((chunk: any) => {
            const match = topMatches.find((m) => m.id === chunk.pinecone_id);
            const score = match?.score || 0;
            const tags = chunk.tags || [];
            const tagStr = tags.length > 0 
                ? ` [Tags: ${tags.map((t: any) => t.name).join(', ')}]`
                : '';
            const projectStr = chunk.project_name 
                ? ` [Project: ${chunk.project_name}]`
                : '';
            
            return `[Document: ${chunk.filename}${projectStr}${tagStr}]\n${chunk.chunk_text}`;
        });

        const context = contextParts.join('\n\n---\n\n');

        // 9. Build sources with metadata
        const sources = chunks.map((chunk: any) => {
            const match = topMatches.find((m) => m.id === chunk.pinecone_id);
            const tags = chunk.tags || [];
            return {
                filename: chunk.filename,
                chunkIndex: chunk.chunk_index,
                relevanceScore: match?.score || 0,
                projectName: chunk.project_name,
                tags: tags.map((t: any) => t.name),
            };
        });

        console.log('[RAG Helper] ✅ Context prepared with project/tag metadata');

        return {
            hasContext: true,
            context,
            sources,
        };

    } catch (error) {
        console.error('[RAG Helper] Error:', error);
        return {
            hasContext: false,
            context: '',
            sources: [],
        };
    }
}

/**
 * Query similar vectors with optional document ID filter
 */
async function querySimilarVectorsWithFilter(
    embedding: number[],
    userId: string,
    mode: string,
    topK: number,
    documentIds: string[] | null
): Promise<Array<{ id: string; score: number }>> {
    // Use the standard querySimilarVectors for now
    // In production, you'd want to pass the documentIds filter to Pinecone
    const results = await querySimilarVectors(embedding, userId, mode, topK);
    
    if (documentIds === null) {
        return results;
    }

    // Post-filter by document IDs
    // Note: This is less efficient than filtering in Pinecone
    // but works for the MVP. For production, update Pinecone metadata to include documentId
    const filteredResults: Array<{ id: string; score: number }> = [];
    
    for (const match of results) {
        // Extract document ID from pinecone_id format: "{docId}-chunk-{index}"
        const docId = match.id.split('-chunk-')[0];
        if (documentIds.includes(docId)) {
            filteredResults.push(match);
        }
    }
    
    return filteredResults;
}

/**
 * Extract project and tag references from user query
 * Uses simple keyword matching for MVP
 */
export function extractQueryFilters(userQuery: string): {
    projectName?: string;
    tagNames?: string[];
    cleanedQuery: string;
} {
    const projectPattern = /(?:from|in|for)\s+(?:project\s+)?["']?([^"'\n,]+?)["']?\s+(?:project)?/gi;
    const tagPattern = /(?:tagged?|with tag|labeled?)\s+["']?([^"'\n,]+?)["']?/gi;
    const tagPattern2 = /#(\w+)/g; // Hashtag style

    let projectName: string | undefined;
    let tagNames: string[] = [];
    let cleanedQuery = userQuery;

    // Extract project reference
    const projectMatch = projectPattern.exec(userQuery);
    if (projectMatch) {
        projectName = projectMatch[1].trim();
        cleanedQuery = cleanedQuery.replace(projectMatch[0], '').trim();
    }

    // Extract tag references
    let tagMatch;
    while ((tagMatch = tagPattern.exec(userQuery)) !== null) {
        tagNames.push(tagMatch[1].trim());
        cleanedQuery = cleanedQuery.replace(tagMatch[0], '').trim();
    }

    while ((tagMatch = tagPattern2.exec(userQuery)) !== null) {
        tagNames.push(tagMatch[1].trim());
        cleanedQuery = cleanedQuery.replace(tagMatch[0], '').trim();
    }

    // Remove duplicate tags
    tagNames = [...new Set(tagNames)];

    return {
        projectName,
        tagNames: tagNames.length > 0 ? tagNames : undefined,
        cleanedQuery: cleanedQuery.replace(/\s+/g, ' ').trim(),
    };
}

/**
 * Inject RAG context into system prompt
 * Enhanced to include project/tag context
 */
export function injectRAGContext(
    originalPrompt: string,
    ragContext: string,
    projectName?: string,
    tagNames?: string[]
): string {
    if (!ragContext) return originalPrompt;

    let scopeInfo = '';
    if (projectName) {
        scopeInfo += `\nNote: The following information is specifically from the "${projectName}" project.`;
    }
    if (tagNames && tagNames.length > 0) {
        scopeInfo += `\nNote: The following documents are tagged with: ${tagNames.join(', ')}.`;
    }

    return `${originalPrompt}

IMPORTANT: You have access to the following relevant information from the user's uploaded documents:
${scopeInfo}

${ragContext}

When answering the user's question, reference this information when relevant. If the information helps answer their question, cite the document name (and project/tags if applicable) in your response.`;
}
