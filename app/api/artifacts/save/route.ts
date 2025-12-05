// app/api/artifacts/save/route.ts - Save generated artifacts with Audit Logging
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { chunkText } from '@/lib/document-processor';
import { generateEmbedding, upsertVectors } from '@/lib/pinecone';
import { auditFromRequest } from '@/lib/audit';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      title, 
      content, 
      artifactType, // 'document', 'table', 'chart'
      mode = 'Sales',
      artifactData // Original artifact data (JSON)
    } = body;

    if (!title || !content || !artifactType) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, artifactType' },
        { status: 400 }
      );
    }

    console.log(`[Artifact Save] Saving ${artifactType}: ${title}`);

    // Convert content to plain text for processing
    let textContent = content;
    if (typeof content === 'object') {
      textContent = JSON.stringify(content, null, 2);
    }

    // Create a synthetic "file" for the artifact
    const filename = `${title}.${artifactType === 'document' ? 'txt' : artifactType}`;
    const fileBuffer = Buffer.from(textContent, 'utf-8');

    // Store artifact in database
    const result = await query<{ id: string }>(
      `INSERT INTO documents (
        user_id, 
        filename, 
        file_type, 
        file_size, 
        file_data, 
        mode,
        source_type,
        artifact_type,
        is_editable,
        artifact_content
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        userId,
        filename,
        `artifact/${artifactType}`,
        fileBuffer.length,
        fileBuffer,
        mode,
        'artifact',
        artifactType,
        true,
        JSON.stringify(artifactData)
      ]
    );

    const documentId = result[0].id;
    console.log(`[Artifact Save] Stored artifact: ${documentId}`);

    // Chunk text for RAG
    const chunks = chunkText(textContent, 1000, 200);
    console.log(`[Artifact Save] Created ${chunks.length} chunks`);

    // Generate embeddings and store in Pinecone
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      console.log(`[Artifact Save] Generating embedding for chunk ${i + 1}/${chunks.length}`);
      const embedding = await generateEmbedding(chunk);

      const pineconeId = `${documentId}-chunk-${i}`;
      
      vectors.push({
        id: pineconeId,
        values: embedding,
        metadata: {
          documentId,
          chunkIndex: i,
          text: chunk.substring(0, 1000),
          userId,
          mode,
        },
      });

      // Store chunk in database
      await query(
        `INSERT INTO document_chunks (document_id, chunk_index, chunk_text, pinecone_id)
         VALUES ($1, $2, $3, $4)`,
        [documentId, i, chunk, pineconeId]
      );
    }

    // Upsert to Pinecone
    console.log(`[Artifact Save] Upserting ${vectors.length} vectors to Pinecone`);
    await upsertVectors(vectors);

    // Audit log
    await auditFromRequest(req, userId, 'artifact.create', 'artifact', documentId, {
      title,
      artifactType,
      mode,
      filename,
      chunksCreated: chunks.length,
      contentLength: textContent.length,
    });

    console.log(`[Artifact Save] ✅ Successfully saved artifact: ${title}`);

    return NextResponse.json({
      success: true,
      documentId,
      filename,
      chunksCreated: chunks.length,
      message: 'Artifact saved successfully',
    });

  } catch (error: any) {
    console.error('[Artifact Save] ❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save artifact',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
