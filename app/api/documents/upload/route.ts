// app/api/documents/upload/route.ts - Enhanced for GraphRAG with Audit Logging
// Upload document with project and tag assignment

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { 
    extractText, 
    chunkText, 
    getFileType, 
    isValidFileType 
} from '@/lib/document-processor';
import { generateEmbedding, upsertVectors } from '@/lib/pinecone';
import { logDocumentAction } from '@/lib/audit';

export const maxDuration = 300; // 5 minutes for large files

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate user
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse form data
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const mode = (formData.get('mode') as string) || 'Sales';
        const projectId = formData.get('projectId') as string | null;
        const tagIds = formData.get('tagIds') as string | null; // Comma-separated

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 3. Validate file type
        if (!isValidFileType(file.name)) {
            return NextResponse.json(
                { error: 'Invalid file type. Supported: PDF, DOCX, TXT, MD' },
                { status: 400 }
            );
        }

        // 4. Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Max size: 10MB' },
                { status: 400 }
            );
        }

        console.log(`[Upload] Processing: ${file.name} (${file.size} bytes)`);

        // 5. Validate project if provided
        let resolvedProjectId = projectId;
        let projectName: string | null = null;

        if (projectId) {
            const project = await query(
                `SELECT id, name FROM projects WHERE id = $1 AND user_id = $2`,
                [projectId, userId]
            );
            if (project.length === 0) {
                return NextResponse.json(
                    { error: 'Invalid project ID' },
                    { status: 400 }
                );
            }
            projectName = project[0].name;
        } else {
            // Create or get default project
            const defaultProject = await query(
                `SELECT create_default_project_if_not_exists($1) as id`,
                [userId]
            );
            resolvedProjectId = defaultProject[0].id;
            
            const project = await query(
                `SELECT name FROM projects WHERE id = $1`,
                [resolvedProjectId]
            );
            projectName = project[0]?.name || 'General';
        }

        // 6. Validate tags if provided
        let tagNames: string[] = [];
        const tagIdArray = tagIds ? tagIds.split(',').filter(Boolean) : [];
        if (tagIdArray.length > 0) {
            const tags = await query(
                `SELECT id, name FROM tags WHERE id = ANY($1) AND user_id = $2`,
                [tagIdArray, userId]
            );
            tagNames = tags.map((t: any) => t.name);
        }

        // 7. Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 8. Extract text from file
        const fileType = getFileType(file.name);
        const text = await extractText(buffer, fileType);

        if (!text || text.trim().length === 0) {
            return NextResponse.json(
                { error: 'Could not extract text from file' },
                { status: 400 }
            );
        }

        console.log(`[Upload] Extracted ${text.length} characters`);

        // 9. Store file in database WITH PROJECT
        const result = await query<{ id: string }>(
            `INSERT INTO documents (user_id, filename, file_type, file_size, file_data, mode, project_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [userId, file.name, fileType, file.size, buffer, mode, resolvedProjectId]
        );

        const documentId = result[0].id;
        console.log(`[Upload] Stored document: ${documentId} in project: ${projectName}`);

        // 10. Add tags to document
        if (tagIdArray.length > 0) {
            for (const tagId of tagIdArray) {
                await query(
                    `INSERT INTO document_tags (document_id, tag_id)
                     VALUES ($1, $2)
                     ON CONFLICT (document_id, tag_id) DO NOTHING`,
                    [documentId, tagId]
                );
            }
            console.log(`[Upload] Added ${tagIdArray.length} tags to document`);
        }

        // 11. Chunk text
        const chunks = chunkText(text, 1000, 200);
        console.log(`[Upload] Created ${chunks.length} chunks`);

        // 12. Generate embeddings and prepare vectors WITH PROJECT/TAG METADATA
        const vectors = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            console.log(`[Upload] Generating embedding for chunk ${i + 1}/${chunks.length}`);
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
                    projectId: resolvedProjectId || '',
                    projectName: projectName || '',
                    tags: tagNames,
                },
            });

            // Store chunk in database
            await query(
                `INSERT INTO document_chunks (document_id, chunk_index, chunk_text, pinecone_id)
                 VALUES ($1, $2, $3, $4)`,
                [documentId, i, chunk, pineconeId]
            );
        }

        // 13. Upsert vectors to Pinecone
        console.log(`[Upload] Upserting ${vectors.length} vectors to Pinecone`);
        await upsertVectors(vectors);

        // 14. Audit log the upload
        await logDocumentAction(userId, 'document.upload', documentId, {
            filename: file.name,
            fileType,
            fileSize: file.size,
            chunksCreated: chunks.length,
            projectId: resolvedProjectId,
            projectName,
            tags: tagNames,
            mode,
        }, req);

        console.log(`[Upload] ✅ Successfully processed: ${file.name}`);

        return NextResponse.json({
            success: true,
            documentId,
            filename: file.name,
            fileSize: file.size,
            chunksCreated: chunks.length,
            projectId: resolvedProjectId,
            projectName,
            tags: tagNames,
            message: 'Document uploaded and processed successfully',
        });

    } catch (error: any) {
        console.error('[Upload] ❌ Error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to process document',
                details: error.message 
            },
            { status: 500 }
        );
    }
}
