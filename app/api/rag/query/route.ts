// app/api/rag/query/route.ts - Query documents using RAG with Audit Logging
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateEmbedding, querySimilarVectors } from '@/lib/pinecone';
import { query } from '@/lib/db';
import { auditFromRequest } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { query: userQuery, mode = 'Sales', topK = 5 } = body;

    if (!userQuery || typeof userQuery !== 'string') {
      return NextResponse.json(
        { error: 'Query text is required' },
        { status: 400 }
      );
    }

    console.log(`[RAG] Query: "${userQuery}" (mode: ${mode}, topK: ${topK})`);

    // 1. Generate embedding for query
    const queryEmbedding = await generateEmbedding(userQuery);

    // 2. Search similar vectors in Pinecone
    const matches = await querySimilarVectors(
      queryEmbedding,
      userId,
      mode,
      topK
    );

    if (matches.length === 0) {
      // Audit search with no results
      await auditFromRequest(req, userId, 'search.rag', 'search', undefined, {
        query: userQuery.substring(0, 200),
        mode,
        topK,
        resultsFound: 0,
      });

      return NextResponse.json({
        success: true,
        hasResults: false,
        context: '',
        sources: [],
        message: 'No relevant documents found',
      });
    }

    console.log(`[RAG] Found ${matches.length} matches`);

    // 3. Get chunk details from database
    const chunkIds = matches.map((m) => m.id);
    const chunks = await query(
      `SELECT 
        dc.chunk_text,
        dc.chunk_index,
        dc.pinecone_id,
        d.filename,
        d.id as document_id
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE dc.pinecone_id = ANY($1)`,
      [chunkIds]
    );

    // 4. Build context from chunks
    const context = chunks
      .map((chunk: any, idx: number) => {
        const score = matches.find((m) => m.id === chunk.pinecone_id)?.score || 0;
        return `[Source ${idx + 1}: ${chunk.filename}, Relevance: ${(score * 100).toFixed(1)}%]\n${chunk.chunk_text}`;
      })
      .join('\n\n---\n\n');

    // 5. Build sources list
    const sources = chunks.map((chunk: any) => {
      const match = matches.find((m) => m.id === chunk.pinecone_id);
      return {
        documentId: chunk.document_id,
        filename: chunk.filename,
        chunkIndex: chunk.chunk_index,
        relevanceScore: match?.score || 0,
        preview: chunk.chunk_text.substring(0, 200) + '...',
      };
    });

    // Audit search with results
    await auditFromRequest(req, userId, 'search.rag', 'search', undefined, {
      query: userQuery.substring(0, 200),
      mode,
      topK,
      resultsFound: chunks.length,
      topScore: matches[0]?.score || 0,
      documentsSearched: [...new Set(chunks.map((c: any) => c.document_id))].length,
    });

    console.log(`[RAG] ✅ Built context from ${chunks.length} chunks`);

    return NextResponse.json({
      success: true,
      hasResults: true,
      context,
      sources,
      query: userQuery,
    });

  } catch (error: any) {
    console.error('[RAG] ❌ Query error:', error);
    return NextResponse.json(
      { error: 'Failed to query documents', details: error.message },
      { status: 500 }
    );
  }
}
