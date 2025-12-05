// app/api/documents/bulk/route.ts
// Bulk document operations: delete, update project, update tags

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { deleteVectorsByDocument, generateEmbedding, upsertVectors } from '@/lib/pinecone';
import { createAuditLog } from '@/lib/audit';

// POST - Bulk operations on documents
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { documentIds, operation, projectId, tagIds, addTags, removeTags } = body;

        if (!Array.isArray(documentIds) || documentIds.length === 0) {
            return NextResponse.json(
                { error: 'documentIds must be a non-empty array' },
                { status: 400 }
            );
        }

        if (!operation) {
            return NextResponse.json(
                { error: 'operation is required' },
                { status: 400 }
            );
        }

        // Verify all documents belong to user
        const docs = await query(
            `SELECT id, filename, mode, project_id FROM documents WHERE id = ANY($1) AND user_id = $2`,
            [documentIds, userId]
        );

        if (docs.length !== documentIds.length) {
            return NextResponse.json(
                { error: 'Some documents not found or access denied' },
                { status: 404 }
            );
        }

        let result: { success: boolean; affected: number; message: string };

        switch (operation) {
            case 'delete':
                result = await bulkDelete(documentIds, userId, req);
                break;
            case 'setProject':
                result = await bulkSetProject(documentIds, projectId, userId, req);
                break;
            case 'setTags':
                result = await bulkSetTags(documentIds, tagIds, userId, req);
                break;
            case 'addTags':
                result = await bulkAddTags(documentIds, addTags, userId, req);
                break;
            case 'removeTags':
                result = await bulkRemoveTags(documentIds, removeTags, userId, req);
                break;
            default:
                return NextResponse.json(
                    { error: `Unknown operation: ${operation}` },
                    { status: 400 }
                );
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[Bulk] ❌ Error:', error);
        return NextResponse.json(
            { error: 'Bulk operation failed', details: error.message },
            { status: 500 }
        );
    }
}

async function bulkDelete(documentIds: string[], userId: string, req: NextRequest) {
    console.log(`[Bulk] Deleting ${documentIds.length} documents...`);

    for (const docId of documentIds) {
        // Delete from Pinecone
        await deleteVectorsByDocument(docId);
        // Delete document tags
        await query(`DELETE FROM document_tags WHERE document_id = $1`, [docId]);
        // Delete document (chunks cascade)
        await query(`DELETE FROM documents WHERE id = $1`, [docId]);
    }

    // Audit log
    await createAuditLog({
        userId,
        action: 'document.delete',
        resource: 'document',
        metadata: {
            bulk: true,
            count: documentIds.length,
            documentIds,
        },
    });

    console.log(`[Bulk] ✅ Deleted ${documentIds.length} documents`);

    return {
        success: true,
        affected: documentIds.length,
        message: `Deleted ${documentIds.length} documents`,
    };
}

async function bulkSetProject(documentIds: string[], projectId: string | null, userId: string, req: NextRequest) {
    console.log(`[Bulk] Setting project for ${documentIds.length} documents...`);

    // Verify project ownership if provided
    let projectName: string | null = null;
    if (projectId) {
        const project = await query(
            `SELECT name FROM projects WHERE id = $1 AND user_id = $2`,
            [projectId, userId]
        );
        if (project.length === 0) {
            throw new Error('Invalid project ID');
        }
        projectName = project[0].name;
    }

    // Update all documents
    await query(
        `UPDATE documents SET project_id = $1, updated_at = NOW() WHERE id = ANY($2)`,
        [projectId, documentIds]
    );

    // Re-index in Pinecone (update metadata)
    await reindexDocuments(documentIds, userId, { projectId, projectName });

    // Audit log
    await createAuditLog({
        userId,
        action: 'document.update' as any,
        resource: 'document',
        metadata: {
            bulk: true,
            operation: 'setProject',
            count: documentIds.length,
            projectId,
            projectName,
        },
    });

    console.log(`[Bulk] ✅ Updated project for ${documentIds.length} documents`);

    return {
        success: true,
        affected: documentIds.length,
        message: `Set project "${projectName || 'none'}" for ${documentIds.length} documents`,
    };
}

async function bulkSetTags(documentIds: string[], tagIds: string[], userId: string, req: NextRequest) {
    console.log(`[Bulk] Setting tags for ${documentIds.length} documents...`);

    // Verify tag ownership
    let tagNames: string[] = [];
    if (tagIds && tagIds.length > 0) {
        const tags = await query(
            `SELECT id, name FROM tags WHERE id = ANY($1) AND user_id = $2`,
            [tagIds, userId]
        );
        tagNames = tags.map((t: any) => t.name);
    }

    for (const docId of documentIds) {
        // Remove existing tags
        await query(`DELETE FROM document_tags WHERE document_id = $1`, [docId]);

        // Add new tags
        for (const tagId of tagIds || []) {
            await query(
                `INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [docId, tagId]
            );
        }
    }

    // Re-index in Pinecone
    await reindexDocuments(documentIds, userId, { tags: tagNames });

    // Audit log
    await createAuditLog({
        userId,
        action: 'document.update' as any,
        resource: 'document',
        metadata: {
            bulk: true,
            operation: 'setTags',
            count: documentIds.length,
            tags: tagNames,
        },
    });

    console.log(`[Bulk] ✅ Set tags for ${documentIds.length} documents`);

    return {
        success: true,
        affected: documentIds.length,
        message: `Set ${tagNames.length} tags for ${documentIds.length} documents`,
    };
}

async function bulkAddTags(documentIds: string[], tagIds: string[], userId: string, req: NextRequest) {
    console.log(`[Bulk] Adding tags to ${documentIds.length} documents...`);

    if (!tagIds || tagIds.length === 0) {
        return { success: true, affected: 0, message: 'No tags to add' };
    }

    // Verify tag ownership
    const tags = await query(
        `SELECT id, name FROM tags WHERE id = ANY($1) AND user_id = $2`,
        [tagIds, userId]
    );
    const tagNames = tags.map((t: any) => t.name);

    for (const docId of documentIds) {
        for (const tagId of tagIds) {
            await query(
                `INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [docId, tagId]
            );
        }
    }

    // Re-index in Pinecone
    await reindexDocuments(documentIds, userId, {});

    // Audit log
    await createAuditLog({
        userId,
        action: 'document.update' as any,
        resource: 'document',
        metadata: {
            bulk: true,
            operation: 'addTags',
            count: documentIds.length,
            addedTags: tagNames,
        },
    });

    console.log(`[Bulk] ✅ Added tags to ${documentIds.length} documents`);

    return {
        success: true,
        affected: documentIds.length,
        message: `Added ${tagNames.length} tags to ${documentIds.length} documents`,
    };
}

async function bulkRemoveTags(documentIds: string[], tagIds: string[], userId: string, req: NextRequest) {
    console.log(`[Bulk] Removing tags from ${documentIds.length} documents...`);

    if (!tagIds || tagIds.length === 0) {
        return { success: true, affected: 0, message: 'No tags to remove' };
    }

    for (const docId of documentIds) {
        await query(
            `DELETE FROM document_tags WHERE document_id = $1 AND tag_id = ANY($2)`,
            [docId, tagIds]
        );
    }

    // Re-index in Pinecone
    await reindexDocuments(documentIds, userId, {});

    // Audit log
    await createAuditLog({
        userId,
        action: 'document.update' as any,
        resource: 'document',
        metadata: {
            bulk: true,
            operation: 'removeTags',
            count: documentIds.length,
            removedTagIds: tagIds,
        },
    });

    console.log(`[Bulk] ✅ Removed tags from ${documentIds.length} documents`);

    return {
        success: true,
        affected: documentIds.length,
        message: `Removed tags from ${documentIds.length} documents`,
    };
}

// Helper to re-index documents in Pinecone with updated metadata
async function reindexDocuments(
    documentIds: string[],
    userId: string,
    updates: { projectId?: string | null; projectName?: string | null; tags?: string[] }
) {
    for (const docId of documentIds) {
        // Get document info
        const docs = await query(
            `SELECT d.mode, d.project_id, p.name as project_name
             FROM documents d
             LEFT JOIN projects p ON d.project_id = p.id
             WHERE d.id = $1`,
            [docId]
        );

        if (docs.length === 0) continue;

        const doc = docs[0];
        const projectId = updates.projectId !== undefined ? updates.projectId : doc.project_id;
        const projectName = updates.projectName !== undefined ? updates.projectName : doc.project_name;

        // Get current tags
        let tagNames = updates.tags;
        if (tagNames === undefined) {
            const existingTags = await query(
                `SELECT t.name FROM tags t JOIN document_tags dt ON t.id = dt.tag_id WHERE dt.document_id = $1`,
                [docId]
            );
            tagNames = existingTags.map((t: any) => t.name);
        }

        // Get chunks
        const chunks = await query(
            `SELECT chunk_index, chunk_text, pinecone_id FROM document_chunks WHERE document_id = $1`,
            [docId]
        );

        if (chunks.length === 0) continue;

        const vectors = [];
        for (const chunk of chunks) {
            const embedding = await generateEmbedding(chunk.chunk_text);
            vectors.push({
                id: chunk.pinecone_id,
                values: embedding,
                metadata: {
                    documentId: docId,
                    chunkIndex: chunk.chunk_index,
                    text: chunk.chunk_text.substring(0, 1000),
                    userId,
                    mode: doc.mode,
                    projectId: projectId || '',
                    projectName: projectName || '',
                    tags: tagNames,
                },
            });
        }

        await upsertVectors(vectors);
    }
}
