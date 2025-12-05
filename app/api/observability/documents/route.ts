// app/api/observability/documents/route.ts
// Document statistics for observability dashboard

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get total documents
        const totalDocs = await query(
            `SELECT COUNT(*) as count FROM documents WHERE user_id = $1`,
            [userId]
        );

        // Get total chunks
        const totalChunks = await query(
            `SELECT COUNT(*) as count 
             FROM document_chunks dc
             JOIN documents d ON dc.document_id = d.id
             WHERE d.user_id = $1`,
            [userId]
        );

        // Get documents by mode
        const byMode = await query(
            `SELECT mode, COUNT(*) as count 
             FROM documents 
             WHERE user_id = $1 
             GROUP BY mode 
             ORDER BY count DESC`,
            [userId]
        );

        // Get documents by file type
        const byType = await query(
            `SELECT file_type as type, COUNT(*) as count 
             FROM documents 
             WHERE user_id = $1 
             GROUP BY file_type 
             ORDER BY count DESC`,
            [userId]
        );

        // Get recent uploads (last 7 days)
        const recentUploads = await query(
            `SELECT COUNT(*) as count 
             FROM documents 
             WHERE user_id = $1 
             AND uploaded_at >= NOW() - INTERVAL '7 days'`,
            [userId]
        );

        // Get documents by project
        const byProject = await query(
            `SELECT 
                COALESCE(p.name, 'Unassigned') as project,
                p.color,
                COUNT(*) as count
             FROM documents d
             LEFT JOIN projects p ON d.project_id = p.id
             WHERE d.user_id = $1
             GROUP BY p.name, p.color
             ORDER BY count DESC
             LIMIT 10`,
            [userId]
        );

        // Get storage size estimate
        const storageSize = await query(
            `SELECT COALESCE(SUM(file_size), 0) as total_size 
             FROM documents 
             WHERE user_id = $1`,
            [userId]
        );

        return NextResponse.json({
            success: true,
            stats: {
                totalDocuments: parseInt(totalDocs[0]?.count || '0'),
                totalChunks: parseInt(totalChunks[0]?.count || '0'),
                byMode: byMode.map((r: any) => ({
                    mode: r.mode,
                    count: parseInt(r.count),
                })),
                byType: byType.map((r: any) => ({
                    type: r.type,
                    count: parseInt(r.count),
                })),
                byProject: byProject.map((r: any) => ({
                    project: r.project,
                    color: r.color,
                    count: parseInt(r.count),
                })),
                recentUploads: parseInt(recentUploads[0]?.count || '0'),
                totalStorageBytes: parseInt(storageSize[0]?.total_size || '0'),
            },
        });

    } catch (error: any) {
        console.error('[Observability] ❌ Document stats error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch document stats', details: error.message },
            { status: 500 }
        );
    }
}
