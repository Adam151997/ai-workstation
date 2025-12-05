// app/api/documents/download/route.ts
// Download original document file

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { logDocumentAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const documentId = searchParams.get('id');

        if (!documentId) {
            return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
        }

        // Fetch document with file data
        const docs = await query(
            `SELECT id, filename, file_type, file_size, file_data, mode
             FROM documents 
             WHERE id = $1 AND user_id = $2`,
            [documentId, userId]
        );

        if (docs.length === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const doc = docs[0];

        if (!doc.file_data) {
            return NextResponse.json({ error: 'File data not available' }, { status: 404 });
        }

        // Determine content type
        const contentTypes: Record<string, string> = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'md': 'text/markdown',
        };

        const contentType = contentTypes[doc.file_type] || 'application/octet-stream';

        // Audit log
        await logDocumentAction(userId, 'document.download', documentId, {
            filename: doc.filename,
            fileType: doc.file_type,
            fileSize: doc.file_size,
        }, req);

        console.log(`[Download] ✅ Serving: ${doc.filename}`);

        // Return file as downloadable response
        return new NextResponse(doc.file_data, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.filename)}"`,
                'Content-Length': doc.file_size.toString(),
            },
        });

    } catch (error: any) {
        console.error('[Download] ❌ Error:', error);
        return NextResponse.json(
            { error: 'Failed to download document', details: error.message },
            { status: 500 }
        );
    }
}
