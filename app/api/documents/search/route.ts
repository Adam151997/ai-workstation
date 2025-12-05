// app/api/documents/search/route.ts
// Full-text search within documents

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { generateEmbedding, querySimilarVectorsFiltered } from '@/lib/pinecone';
import { logSearchAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q');
        const mode = searchParams.get('mode') || 'Sales';
        const projectId = searchParams.get('projectId');
        const searchType = searchParams.get('type') || 'semantic'; // 'semantic' or 'text'
        const limit = parseInt(searchParams.get('limit') || '20');

        if (!q || q.trim().length === 0) {
            return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
        }

        console.log(`[Search] Query: "${q}" (${searchType})`);

        let results: any[] = [];

        if (searchType === 'semantic') {
            // Semantic search using Pinecone
            const embedding = await generateEmbedding(q);
            
            const vectorResults = await querySimilarVectorsFiltered(
                embedding,
                userId,
                mode,
                {
                    projectId: projectId || undefined,
                    topK: limit,
                }
            );

            // Get unique document IDs
            const docIds = [...new Set(vectorResults.map(r => r.metadata?.documentId).filter(Boolean))];

            if (docIds.length > 0) {
                // Fetch document details
                const docs = await query(
                    `SELECT 
                        d.id,
                        d.filename,
                        d.file_type,
                        d.file_size,
                        d.uploaded_at,
                        d.mode,
                        d.project_id,
                        p.name as project_name,
                        p.color as project_color,
                        (SELECT COUNT(*) FROM document_chunks WHERE document_id = d.id) as chunk_count
                     FROM documents d
                     LEFT JOIN projects p ON d.project_id = p.id
                     WHERE d.id = ANY($1) AND d.user_id = $2`,
                    [docIds, userId]
                );

                // Build results with relevance scores and matching chunks
                for (const doc of docs) {
                    const matchingChunks = vectorResults
                        .filter(r => r.metadata?.documentId === doc.id)
                        .map(r => ({
                            text: r.metadata?.text || '',
                            score: r.score,
                            chunkIndex: r.metadata?.chunkIndex,
                        }))
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 3); // Top 3 matching chunks

                    results.push({
                        id: doc.id,
                        filename: doc.filename,
                        fileType: doc.file_type,
                        fileSize: doc.file_size,
                        uploadedAt: doc.uploaded_at,
                        mode: doc.mode,
                        projectId: doc.project_id,
                        projectName: doc.project_name,
                        projectColor: doc.project_color,
                        chunkCount: parseInt(doc.chunk_count),
                        relevanceScore: Math.max(...matchingChunks.map(c => c.score)),
                        matchingChunks,
                    });
                }

                // Sort by relevance
                results.sort((a, b) => b.relevanceScore - a.relevanceScore);
            }
        } else {
            // Text search using PostgreSQL ILIKE
            let searchQuery = `
                SELECT DISTINCT ON (d.id)
                    d.id,
                    d.filename,
                    d.file_type,
                    d.file_size,
                    d.uploaded_at,
                    d.mode,
                    d.project_id,
                    p.name as project_name,
                    p.color as project_color,
                    (SELECT COUNT(*) FROM document_chunks WHERE document_id = d.id) as chunk_count,
                    dc.chunk_text as matching_chunk
                FROM documents d
                JOIN document_chunks dc ON d.id = dc.document_id
                LEFT JOIN projects p ON d.project_id = p.id
                WHERE d.user_id = $1
                  AND d.mode = $2
                  AND dc.chunk_text ILIKE $3
            `;
            const searchPattern = `%${q}%`;
            const params: any[] = [userId, mode, searchPattern];
            let paramIndex = 4;

            if (projectId) {
                searchQuery += ` AND d.project_id = $${paramIndex++}`;
                params.push(projectId);
            }

            searchQuery += ` ORDER BY d.id, d.uploaded_at DESC LIMIT $${paramIndex}`;
            params.push(limit);

            const textResults = await query(searchQuery, params);

            results = textResults.map((doc: any) => ({
                id: doc.id,
                filename: doc.filename,
                fileType: doc.file_type,
                fileSize: doc.file_size,
                uploadedAt: doc.uploaded_at,
                mode: doc.mode,
                projectId: doc.project_id,
                projectName: doc.project_name,
                projectColor: doc.project_color,
                chunkCount: parseInt(doc.chunk_count),
                relevanceScore: 1,
                matchingChunks: [{
                    text: doc.matching_chunk?.substring(0, 500) || '',
                    score: 1,
                }],
            }));
        }

        // Audit log (non-blocking)
        logSearchAction(userId, 'search.query', {
            query: q,
            type: searchType,
            mode,
            projectId,
            resultCount: results.length,
        }, req).catch(() => {});

        console.log(`[Search] ✅ Found ${results.length} documents`);

        return NextResponse.json({
            success: true,
            query: q,
            type: searchType,
            results,
            count: results.length,
        });

    } catch (error: any) {
        console.error('[Search] ❌ Error:', error);
        return NextResponse.json(
            { error: 'Search failed', details: error.message },
            { status: 500 }
        );
    }
}
