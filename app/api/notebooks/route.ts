// app/api/notebooks/route.ts
// CRUD API for Business Notebooks

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

// GET - List all notebooks for user
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const status = searchParams.get('status');
        const includeShared = searchParams.get('includeShared') === 'true';

        let sql = `
            SELECT 
                n.*,
                (SELECT COUNT(*) FROM notebook_cells WHERE notebook_id = n.id) as cell_count,
                (SELECT COUNT(*) FROM notebook_runs WHERE notebook_id = n.id) as run_count
            FROM notebooks n
            WHERE (n.user_id = $1 ${includeShared ? "OR $1 = ANY(n.shared_with) OR n.is_public = true" : ""})
        `;
        const params: any[] = [userId];

        if (projectId) {
            params.push(projectId);
            sql += ` AND n.project_id = $${params.length}`;
        }

        if (status) {
            params.push(status);
            sql += ` AND n.status = $${params.length}`;
        }

        sql += ` ORDER BY n.updated_at DESC`;

        const notebooks = await query(sql, params);

        return NextResponse.json({ notebooks });

    } catch (error: any) {
        console.error('[Notebooks] GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notebooks', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new notebook
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { 
            title = 'Untitled Notebook', 
            description, 
            icon = '📓',
            projectId,
            tags = [],
            templateId,  // Optional: create from template
            templateVariables = {}
        } = body;

        let cells: any[] = [];

        // If creating from template, fetch template cells
        if (templateId) {
            const templates = await query(
                'SELECT * FROM notebook_templates WHERE id = $1',
                [templateId]
            );

            if (templates.length > 0) {
                const template = templates[0];
                cells = template.cells_template || [];

                // Replace variables in cell content
                cells = cells.map((cell: any) => {
                    let content = cell.content;
                    for (const [key, value] of Object.entries(templateVariables)) {
                        content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
                    }
                    return { ...cell, content };
                });

                // Increment template usage count
                await query(
                    'UPDATE notebook_templates SET usage_count = usage_count + 1 WHERE id = $1',
                    [templateId]
                );
            }
        }

        // Create notebook
        const result = await query(
            `INSERT INTO notebooks (user_id, title, description, icon, project_id, tags)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [userId, title, description, icon, projectId || null, tags]
        );

        const notebook = result[0];

        // Create cells if from template
        if (cells.length > 0) {
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                await query(
                    `INSERT INTO notebook_cells 
                     (notebook_id, user_id, cell_index, cell_type, title, content)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [notebook.id, userId, i, cell.type || 'command', cell.title, cell.content]
                );
            }
        }

        // Fetch complete notebook with cells
        const fullNotebook = await query(
            `SELECT 
                n.*,
                COALESCE(
                    (SELECT json_agg(c ORDER BY c.cell_index) 
                     FROM notebook_cells c 
                     WHERE c.notebook_id = n.id),
                    '[]'::json
                ) as cells
             FROM notebooks n
             WHERE n.id = $1`,
            [notebook.id]
        );

        console.log(`[Notebooks] ✅ Created notebook: ${notebook.id}`);

        return NextResponse.json({ 
            success: true,
            notebook: fullNotebook[0]
        });

    } catch (error: any) {
        console.error('[Notebooks] POST error:', error);
        return NextResponse.json(
            { error: 'Failed to create notebook', details: error.message },
            { status: 500 }
        );
    }
}
