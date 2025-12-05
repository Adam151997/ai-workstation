// app/api/documents/route.ts - ENHANCED with Project, Tags & Audit Logging
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { deleteVectorsByDocument } from '@/lib/pinecone';
import { logDocumentAction } from '@/lib/audit';

// GET - List all documents for user
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const projectId = searchParams.get('projectId');

    let queryText = `
      SELECT 
        d.id,
        d.filename,
        d.file_type,
        d.file_size,
        d.uploaded_at,
        d.mode,
        d.source_type,
        d.artifact_type,
        d.is_editable,
        d.project_id,
        p.name as project_name,
        p.color as project_color,
        COUNT(dc.id) as chunk_count,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM document_tags dt
           JOIN tags t ON dt.tag_id = t.id
           WHERE dt.document_id = d.id),
          '[]'::json
        ) as tags
      FROM documents d
      LEFT JOIN document_chunks dc ON d.id = dc.document_id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (mode) {
      queryText += ` AND d.mode = $${paramIndex++}`;
      params.push(mode);
    }

    if (projectId) {
      queryText += ` AND d.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    queryText += `
      GROUP BY d.id, d.filename, d.file_type, d.file_size, d.uploaded_at, d.mode, 
               d.source_type, d.artifact_type, d.is_editable, d.project_id, p.name, p.color
      ORDER BY d.uploaded_at DESC
    `;

    const documents = await query(queryText, params);

    return NextResponse.json({
      success: true,
      documents: documents.map((doc: any) => ({
        id: doc.id,
        filename: doc.filename,
        fileType: doc.file_type,
        fileSize: doc.file_size,
        uploadedAt: doc.uploaded_at,
        mode: doc.mode,
        chunkCount: parseInt(doc.chunk_count),
        sourceType: doc.source_type || 'upload',
        artifactType: doc.artifact_type,
        isEditable: doc.is_editable || false,
        projectId: doc.project_id,
        projectName: doc.project_name,
        projectColor: doc.project_color,
        tags: doc.tags || [],
      })),
    });

  } catch (error: any) {
    console.error('[Documents] ❌ List error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a document
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    // Verify document belongs to user and get details for audit
    const docs = await query(
      `SELECT id, filename, file_type, file_size, mode, project_id FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (docs.length === 0) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    const docInfo = docs[0];
    console.log(`[Documents] Deleting document: ${documentId} (${docInfo.filename})`);

    // Delete from Pinecone
    await deleteVectorsByDocument(documentId);

    // Delete document tags first
    await query(`DELETE FROM document_tags WHERE document_id = $1`, [documentId]);

    // Delete from database (chunks will be deleted via CASCADE)
    await query(`DELETE FROM documents WHERE id = $1`, [documentId]);

    // Audit log the deletion
    await logDocumentAction(userId, 'document.delete', documentId, {
      filename: docInfo.filename,
      fileType: docInfo.file_type,
      fileSize: docInfo.file_size,
      mode: docInfo.mode,
      projectId: docInfo.project_id,
    }, req);

    console.log(`[Documents] ✅ Deleted document: ${documentId}`);

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });

  } catch (error: any) {
    console.error('[Documents] ❌ Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document', details: error.message },
      { status: 500 }
    );
  }
}
