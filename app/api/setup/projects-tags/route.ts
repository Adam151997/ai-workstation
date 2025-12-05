// app/api/setup/projects-tags/route.ts
// Migration endpoint for Lightweight GraphRAG tables
// Phase 2: Projects & Tags for document organization

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const maxDuration = 300;

export async function GET() {
    try {
        console.log('[Setup] 🚀 Running Lightweight GraphRAG migration...');

        // ========================================
        // 1. Projects Table
        // ========================================
        console.log('[Setup] Creating projects table...');
        await query(`
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(100) NOT NULL,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                color VARCHAR(7) DEFAULT '#6366f1',
                icon VARCHAR(50) DEFAULT 'folder',
                is_archived BOOLEAN DEFAULT false,
                document_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_projects_user_archived ON projects(user_id, is_archived)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(user_id, name)`);

        // ========================================
        // 2. Tags Table
        // ========================================
        console.log('[Setup] Creating tags table...');
        await query(`
            CREATE TABLE IF NOT EXISTS tags (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(100) NOT NULL,
                name VARCHAR(100) NOT NULL,
                color VARCHAR(7) DEFAULT '#8b5cf6',
                description TEXT,
                usage_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, name)
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags(user_id, usage_count DESC)`);

        // ========================================
        // 3. Document Tags Junction Table
        // ========================================
        console.log('[Setup] Creating document_tags table...');
        await query(`
            CREATE TABLE IF NOT EXISTS document_tags (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(document_id, tag_id)
            )
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_doc_tags_document ON document_tags(document_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_doc_tags_tag ON document_tags(tag_id)`);

        // ========================================
        // 4. Add project_id to documents
        // ========================================
        console.log('[Setup] Adding project_id to documents table...');
        await query(`
            ALTER TABLE documents 
            ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_documents_user_project ON documents(user_id, project_id)`);

        // ========================================
        // 5. Create default project function
        // ========================================
        console.log('[Setup] Creating default project function...');
        await query(`
            CREATE OR REPLACE FUNCTION create_default_project_if_not_exists(p_user_id VARCHAR)
            RETURNS UUID AS $$
            DECLARE
                v_project_id UUID;
            BEGIN
                SELECT id INTO v_project_id 
                FROM projects 
                WHERE user_id = p_user_id AND name = 'General'
                LIMIT 1;
                
                IF v_project_id IS NULL THEN
                    INSERT INTO projects (user_id, name, description, color, icon)
                    VALUES (p_user_id, 'General', 'Default project for unorganized documents', '#6b7280', 'inbox')
                    RETURNING id INTO v_project_id;
                END IF;
                
                RETURN v_project_id;
            END;
            $$ LANGUAGE plpgsql
        `);

        // ========================================
        // 6. Project document count trigger
        // ========================================
        console.log('[Setup] Creating project document count trigger...');
        await query(`
            CREATE OR REPLACE FUNCTION update_project_document_count()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' AND NEW.project_id IS NOT NULL THEN
                    UPDATE projects SET document_count = document_count + 1 WHERE id = NEW.project_id;
                END IF;
                
                IF TG_OP = 'DELETE' AND OLD.project_id IS NOT NULL THEN
                    UPDATE projects SET document_count = document_count - 1 WHERE id = OLD.project_id;
                END IF;
                
                IF TG_OP = 'UPDATE' THEN
                    IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
                        IF OLD.project_id IS NOT NULL THEN
                            UPDATE projects SET document_count = document_count - 1 WHERE id = OLD.project_id;
                        END IF;
                        IF NEW.project_id IS NOT NULL THEN
                            UPDATE projects SET document_count = document_count + 1 WHERE id = NEW.project_id;
                        END IF;
                    END IF;
                END IF;
                
                RETURN COALESCE(NEW, OLD);
            END;
            $$ LANGUAGE plpgsql
        `);

        await query(`DROP TRIGGER IF EXISTS trigger_update_project_doc_count ON documents`);
        await query(`
            CREATE TRIGGER trigger_update_project_doc_count
            AFTER INSERT OR UPDATE OR DELETE ON documents
            FOR EACH ROW
            EXECUTE FUNCTION update_project_document_count()
        `);

        // ========================================
        // 7. Tag usage count trigger
        // ========================================
        console.log('[Setup] Creating tag usage count trigger...');
        await query(`
            CREATE OR REPLACE FUNCTION update_tag_usage_count()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
                    RETURN NEW;
                ELSIF TG_OP = 'DELETE' THEN
                    UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
                    RETURN OLD;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql
        `);

        await query(`DROP TRIGGER IF EXISTS trigger_update_tag_usage ON document_tags`);
        await query(`
            CREATE TRIGGER trigger_update_tag_usage
            AFTER INSERT OR DELETE ON document_tags
            FOR EACH ROW
            EXECUTE FUNCTION update_tag_usage_count()
        `);

        // ========================================
        // 8. Helper views
        // ========================================
        console.log('[Setup] Creating helper views...');
        
        await query(`
            CREATE OR REPLACE VIEW documents_with_metadata AS
            SELECT 
                d.id,
                d.user_id,
                d.filename,
                d.file_type,
                d.file_size,
                d.mode,
                d.uploaded_at,
                d.source_type,
                d.artifact_type,
                d.project_id,
                p.name as project_name,
                p.color as project_color,
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'id', t.id,
                        'name', t.name,
                        'color', t.color
                    ))
                    FROM document_tags dt
                    JOIN tags t ON dt.tag_id = t.id
                    WHERE dt.document_id = d.id),
                    '[]'::json
                ) as tags
            FROM documents d
            LEFT JOIN projects p ON d.project_id = p.id
        `);

        await query(`
            CREATE OR REPLACE VIEW project_summary AS
            SELECT 
                p.id,
                p.user_id,
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
        `);

        // ========================================
        // 9. Log migration
        // ========================================
        console.log('[Setup] Logging migration...');
        await query(`
            INSERT INTO migrations_log (migration_name) 
            VALUES ('004_lightweight_graphrag_v1')
            ON CONFLICT DO NOTHING
        `);

        console.log('[Setup] ✅ Lightweight GraphRAG migration complete!');

        return NextResponse.json({
            success: true,
            message: 'Lightweight GraphRAG migration completed successfully!',
            tables_created: ['projects', 'tags', 'document_tags'],
            columns_added: ['documents.project_id'],
            views_created: ['documents_with_metadata', 'project_summary'],
            triggers_created: ['trigger_update_project_doc_count', 'trigger_update_tag_usage'],
            functions_created: ['create_default_project_if_not_exists', 'update_project_document_count', 'update_tag_usage_count'],
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Migration failed:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message,
                hint: 'Check database connection and permissions',
                details: error.detail || error.code,
            },
            { status: 500 }
        );
    }
}

export async function POST() {
    try {
        console.log('[Setup] Verifying GraphRAG tables...');

        const tables = ['projects', 'tags', 'document_tags'];
        const results: Record<string, { exists: boolean; rowCount: number }> = {};

        for (const table of tables) {
            try {
                const countResult = await query(`SELECT COUNT(*) as count FROM ${table}`);
                results[table] = {
                    exists: true,
                    rowCount: parseInt(countResult[0].count, 10),
                };
            } catch {
                results[table] = {
                    exists: false,
                    rowCount: 0,
                };
            }
        }

        // Check project_id column
        let projectIdExists = false;
        try {
            await query(`SELECT project_id FROM documents LIMIT 1`);
            projectIdExists = true;
        } catch {
            projectIdExists = false;
        }

        const allExist = Object.values(results).every(r => r.exists) && projectIdExists;

        return NextResponse.json({
            success: true,
            migrationComplete: allExist,
            tables: results,
            projectIdColumn: projectIdExists,
            message: allExist 
                ? 'All GraphRAG tables exist and are ready' 
                : 'Some tables are missing - run GET to create them',
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Verification failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
