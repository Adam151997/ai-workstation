// app/api/documents/[id]/route.ts
// Single document operations: view, update project/tags, re-index

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { generateEmbedding, upsertVectors } from '@/lib/pinecone';
import { logDocumentAction } from '@/lib/audit';

// GET - Get single document details
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const docs = await query(
            `SELECT 
                d.id,
                d.filename,
                d.file_type,
                d.file_size,
                d.uploaded_at,
                d.mode,
                d.source_type,
                d.project_id,
                p.name as project_name,
                p.color as project_color,
                (SELECT COUNT(*) FROM document_chunks WHERE document_id = d.id) as chunk_count,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
                     FROM document_tags dt
                     JOIN tags t ON dt.tag_id = t.id
                     WHERE dt.document_id = d.id),
                    '[]'::json
                ) as tags
             FROM documents d
             LEFT JOIN projects p ON d.project_id = p.id
             WHERE d.id = $1 AND d.user_id = $2`,
            [id, userId]
        );

        if (docs.length === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const doc = docs[0];

        return NextResponse.json({
            success: true,
            document: {
                id: doc.id,
                filename: doc.filename,
                fileType: doc.file_type,
                fileSize: doc.file_size,
                uploadedAt: doc.uploaded_at,
                mode: doc.mode,
                sourceType: doc.source_type,
                projectId: doc.project_id,
                projectName: doc.project_name,
                projectColor: doc.project_color,
                chunkCount: parseInt(doc.chunk_count),
                tags: doc.tags || [],
            },
        });

    } catch (error: any) {
        console.error('[Document] ❌ Get error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch document', details: error.message },
            { status: 500 }
        );
    }
}

// PATCH - Update document metadata (project, tags) and re-index
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { projectId, tagIds, reindex = true } = body;

        // Verify document ownership
        const docs = await query(
            `SELECT id, filename, mode, project_id FROM documents WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (docs.length === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const doc = docs[0];
        const changes: Record<string, any> = {};

        // Update project if provided
        let newProjectName: string | null = null;
        if (projectId !== undefined) {
            if (projectId) {
                // Verify project ownership
                const project = await query(
                    `SELECT id, name FROM projects WHERE id = $1 AND user_id = $2`,
                    [projectId, userId]
                );
                if (project.length === 0) {
                    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
                }
                newProjectName = project[0].name;
            }

            await query(
                `UPDATE documents SET project_id = $1, updated_at = NOW() WHERE id = $2`,
                [projectId || null, id]
            );
            changes.projectId = projectId;
            changes.projectName = newProjectName;
            console.log(`[Document] Updated project to: ${newProjectName || 'none'}`);
        }

        // Update tags if provided
        let newTagNames: string[] = [];
        if (tagIds !== undefined) {
            // Remove existing tags
            await query(`DELETE FROM document_tags WHERE document_id = $1`, [id]);

            // Add new tags
            if (Array.isArray(tagIds) && tagIds.length > 0) {
                // Verify tag ownership
                const tags = await query(
                    `SELECT id, name FROM tags WHERE id = ANY($1) AND user_id = $2`,
                    [tagIds, userId]
                );
                newTagNames = tags.map((t: any) => t.name);

                for (const tagId of tagIds) {
                    await query(
                        `INSERT INTO document_tags (document_id, tag_id)
                         VALUES ($1, $2)
                         ON CONFLICT (document_id, tag_id) DO NOTHING`,
                        [id, tagId]
                    );
                }
            }
            changes.tags = newTagNames;
            console.log(`[Document] Updated tags to: ${newTagNames.join(', ') || 'none'}`);
        }

        // Re-index in Pinecone if requested
        if (reindex && (projectId !== undefined || tagIds !== undefined)) {
            console.log(`[Document] 🔄 Re-indexing document in Pinecone...`);

            // Get current project info
            const currentProject = projectId !== undefined ? projectId : doc.project_id;
            let projectName = newProjectName;
            if (!projectName && currentProject) {
                const proj = await query(`SELECT name FROM projects WHERE id = $1`, [currentProject]);
                projectName = proj[0]?.name || '';
            }

            // Get current tags
            let tagNames = newTagNames;
            if (tagIds === undefined) {
                const existingTags = await query(
                    `SELECT t.name FROM tags t
                     JOIN document_tags dt ON t.id = dt.tag_id
                     WHERE dt.document_id = $1`,
                    [id]
                );
                tagNames = existingTags.map((t: any) => t.name);
            }

            // Get all chunks for this document
            const chunks = await query(
                `SELECT chunk_index, chunk_text, pinecone_id FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index`,
                [id]
            );

            if (chunks.length > 0) {
                const vectors = [];
                for (const chunk of chunks) {
                    // Generate new embedding (or reuse existing)
                    const embedding = await generateEmbedding(chunk.chunk_text);

                    vectors.push({
                        id: chunk.pinecone_id,
                        values: embedding,
                        metadata: {
                            documentId: id,
                            chunkIndex: chunk.chunk_index,
                            text: chunk.chunk_text.substring(0, 1000),
                            userId,
                            mode: doc.mode,
                            projectId: currentProject || '',
                            projectName: projectName || '',
                            tags: tagNames,
                        },
                    });
                }

                // Upsert to Pinecone (updates metadata)
                await upsertVectors(vectors);
                console.log(`[Document] ✅ Re-indexed ${vectors.length} chunks`);
            }
        }

        // Audit log
        await logDocumentAction(userId, 'document.update', id, {
            filename: doc.filename,
            changes,
            reindexed: reindex,
        }, req);

        return NextResponse.json({
            success: true,
            message: 'Document updated successfully',
            changes,
            reindexed: reindex,
        });

    } catch (error: any) {
        console.error('[Document] ❌ Update error:', error);
        return NextResponse.json(
            { error: 'Failed to update document', details: error.message },
            { status: 500 }
        );
    }
}
