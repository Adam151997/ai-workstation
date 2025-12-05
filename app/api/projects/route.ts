// app/api/projects/route.ts
// Projects API - CRUD operations with Audit Logging

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { logProjectAction } from '@/lib/audit';

// GET - List all projects for user
export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const includeArchived = searchParams.get('includeArchived') === 'true';

        let sql = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.color,
                p.icon,
                p.is_archived,
                p.document_count,
                p.created_at,
                p.updated_at,
                (SELECT COUNT(*) FROM document_chunks dc 
                 JOIN documents d ON dc.document_id = d.id 
                 WHERE d.project_id = p.id) as chunk_count
            FROM projects p
            WHERE p.user_id = $1
        `;
        
        if (!includeArchived) {
            sql += ` AND p.is_archived = false`;
        }
        
        sql += ` ORDER BY p.name ASC`;

        const projects = await query(sql, [userId]);

        // Ensure user has a default project
        if (projects.length === 0) {
            const defaultProject = await query(
                `SELECT create_default_project_if_not_exists($1) as id`,
                [userId]
            );
            
            // Fetch the created project
            const newProject = await query(
                `SELECT * FROM projects WHERE id = $1`,
                [defaultProject[0].id]
            );
            
            return NextResponse.json({
                success: true,
                projects: newProject.map(formatProject),
            });
        }

        return NextResponse.json({
            success: true,
            projects: projects.map(formatProject),
        });

    } catch (error: any) {
        console.error('[Projects] ❌ List error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch projects', details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new project
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name, description, color, icon } = body;

        if (!name || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Project name is required' },
                { status: 400 }
            );
        }

        // Check for duplicate name
        const existing = await query(
            `SELECT id FROM projects WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
            [userId, name.trim()]
        );

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'A project with this name already exists' },
                { status: 409 }
            );
        }

        const result = await query(
            `INSERT INTO projects (user_id, name, description, color, icon)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, name.trim(), description || null, color || '#6366f1', icon || 'folder']
        );

        const project = result[0];

        // Audit log
        await logProjectAction(userId, 'project.create', project.id, {
            name: project.name,
            color: project.color,
        }, req);

        console.log(`[Projects] ✅ Created project: ${name}`);

        return NextResponse.json({
            success: true,
            project: formatProject(project),
        });

    } catch (error: any) {
        console.error('[Projects] ❌ Create error:', error);
        return NextResponse.json(
            { error: 'Failed to create project', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a project
export async function PUT(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, name, description, color, icon, is_archived } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership
        const existing = await query(
            `SELECT id, name FROM projects WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        const oldName = existing[0].name;

        // Build update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name.trim());
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (color !== undefined) {
            updates.push(`color = $${paramIndex++}`);
            values.push(color);
        }
        if (icon !== undefined) {
            updates.push(`icon = $${paramIndex++}`);
            values.push(icon);
        }
        if (is_archived !== undefined) {
            updates.push(`is_archived = $${paramIndex++}`);
            values.push(is_archived);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await query(
            `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        const project = result[0];

        // Determine audit action
        const auditAction = is_archived !== undefined 
            ? (is_archived ? 'project.archive' : 'project.update')
            : 'project.update';

        // Audit log
        await logProjectAction(userId, auditAction as any, id, {
            oldName,
            newName: name,
            color,
            isArchived: is_archived,
        }, req);

        console.log(`[Projects] ✅ Updated project: ${id}`);

        return NextResponse.json({
            success: true,
            project: formatProject(project),
        });

    } catch (error: any) {
        console.error('[Projects] ❌ Update error:', error);
        return NextResponse.json(
            { error: 'Failed to update project', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a project
export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            );
        }

        // Verify ownership and get project
        const existing = await query(
            `SELECT id, name FROM projects WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        const projectName = existing[0].name;

        // Don't allow deleting "General" project
        if (projectName === 'General') {
            return NextResponse.json(
                { error: 'Cannot delete the default General project' },
                { status: 400 }
            );
        }

        // Move documents to General project before deleting
        const generalProject = await query(
            `SELECT id FROM projects WHERE user_id = $1 AND name = 'General'`,
            [userId]
        );

        if (generalProject.length > 0) {
            await query(
                `UPDATE documents SET project_id = $1 WHERE project_id = $2`,
                [generalProject[0].id, id]
            );
        } else {
            await query(
                `UPDATE documents SET project_id = NULL WHERE project_id = $1`,
                [id]
            );
        }

        // Delete the project
        await query(`DELETE FROM projects WHERE id = $1`, [id]);

        // Audit log
        await logProjectAction(userId, 'project.delete', id, {
            name: projectName,
        }, req);

        console.log(`[Projects] ✅ Deleted project: ${id}`);

        return NextResponse.json({
            success: true,
            message: 'Project deleted successfully',
        });

    } catch (error: any) {
        console.error('[Projects] ❌ Delete error:', error);
        return NextResponse.json(
            { error: 'Failed to delete project', details: error.message },
            { status: 500 }
        );
    }
}

// Helper function to format project response
function formatProject(row: any) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        icon: row.icon,
        isArchived: row.is_archived,
        documentCount: parseInt(row.document_count) || 0,
        chunkCount: parseInt(row.chunk_count) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
