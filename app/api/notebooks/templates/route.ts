// app/api/notebooks/templates/route.ts
// Browse and use notebook templates

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// GET - List all public templates
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');

        let sql = `
            SELECT * FROM notebook_templates 
            WHERE is_public = true
        `;
        const params: any[] = [];

        if (category) {
            params.push(category);
            sql += ` AND category = $${params.length}`;
        }

        sql += ` ORDER BY is_official DESC, usage_count DESC, created_at DESC`;

        const templates = await query(sql, params);

        return NextResponse.json({ templates });

    } catch (error: any) {
        console.error('[Templates] GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch templates', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a template from an existing notebook
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { 
            notebookId,  // Create template from this notebook
            name,
            description,
            icon = '📋',
            category,
            variables = [],
            isPublic = true
        } = body;

        if (!notebookId) {
            return NextResponse.json({ error: 'notebookId is required' }, { status: 400 });
        }

        // Get notebook cells
        const notebooks = await query(
            `SELECT n.*, 
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'type', c.cell_type,
                        'title', c.title,
                        'content', c.content
                    ) ORDER BY c.cell_index)
                     FROM notebook_cells c WHERE c.notebook_id = n.id),
                    '[]'::json
                ) as cells_template
             FROM notebooks n
             WHERE n.id = $1 AND n.user_id = $2`,
            [notebookId, userId]
        );

        if (notebooks.length === 0) {
            return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
        }

        const notebook = notebooks[0];

        // Create template
        const result = await query(
            `INSERT INTO notebook_templates 
             (name, description, icon, category, cells_template, variables, author_id, is_public)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                name || notebook.title,
                description || notebook.description,
                icon,
                category,
                JSON.stringify(notebook.cells_template),
                JSON.stringify(variables),
                userId,
                isPublic
            ]
        );

        console.log(`[Templates] ✅ Created template from notebook ${notebookId}`);

        return NextResponse.json({ 
            success: true,
            template: result[0] 
        });

    } catch (error: any) {
        console.error('[Templates] POST error:', error);
        return NextResponse.json(
            { error: 'Failed to create template', details: error.message },
            { status: 500 }
        );
    }
}
