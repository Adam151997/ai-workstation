-- Migration: Lightweight GraphRAG - Projects & Tags
-- Phase 2: Document Organization with Metadata-Filtered Vector Search
-- Run via: http://localhost:3000/api/setup/projects-tags

-- ============================================
-- 1. Projects Table
-- ============================================
-- Organizes documents into logical groupings

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI
    icon VARCHAR(50) DEFAULT 'folder', -- Lucide icon name
    is_archived BOOLEAN DEFAULT false,
    document_count INTEGER DEFAULT 0, -- Denormalized for performance
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_archived ON projects(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(user_id, name);

-- ============================================
-- 2. Tags Table
-- ============================================
-- Flexible labels for documents

CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#8b5cf6', -- Hex color
    description TEXT,
    usage_count INTEGER DEFAULT 0, -- Denormalized for sorting by popularity
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name) -- Each user has unique tag names
);

-- Indexes for tags
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON tags(user_id, usage_count DESC);

-- ============================================
-- 3. Document Tags Junction Table
-- ============================================
-- Many-to-many relationship between documents and tags

CREATE TABLE IF NOT EXISTS document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(document_id, tag_id)
);

-- Indexes for document_tags
CREATE INDEX IF NOT EXISTS idx_doc_tags_document ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_tags_tag ON document_tags(tag_id);

-- ============================================
-- 4. Add project_id to documents table
-- ============================================

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Index for project lookup
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_project ON documents(user_id, project_id);

-- ============================================
-- 5. Create Default "General" Project for Each User
-- ============================================
-- This ensures every document has a project

-- Function to create default project for a user
CREATE OR REPLACE FUNCTION create_default_project_if_not_exists(p_user_id VARCHAR)
RETURNS UUID AS $$
DECLARE
    v_project_id UUID;
BEGIN
    -- Check if user already has a default project
    SELECT id INTO v_project_id 
    FROM projects 
    WHERE user_id = p_user_id AND name = 'General'
    LIMIT 1;
    
    -- Create if not exists
    IF v_project_id IS NULL THEN
        INSERT INTO projects (user_id, name, description, color, icon)
        VALUES (p_user_id, 'General', 'Default project for unorganized documents', '#6b7280', 'inbox')
        RETURNING id INTO v_project_id;
    END IF;
    
    RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Trigger to Update Project Document Count
-- ============================================

CREATE OR REPLACE FUNCTION update_project_document_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' AND NEW.project_id IS NOT NULL THEN
        UPDATE projects SET document_count = document_count + 1 WHERE id = NEW.project_id;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' AND OLD.project_id IS NOT NULL THEN
        UPDATE projects SET document_count = document_count - 1 WHERE id = OLD.project_id;
    END IF;
    
    -- Handle UPDATE (project changed)
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_doc_count ON documents;
CREATE TRIGGER trigger_update_project_doc_count
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_project_document_count();

-- ============================================
-- 7. Trigger to Update Tag Usage Count
-- ============================================

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tag_usage ON document_tags;
CREATE TRIGGER trigger_update_tag_usage
    AFTER INSERT OR DELETE ON document_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_tag_usage_count();

-- ============================================
-- 8. Helper Views
-- ============================================

-- Documents with project and tag info
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
LEFT JOIN projects p ON d.project_id = p.id;

-- Project summary view
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
FROM projects p;

-- ============================================
-- 9. Table Comments
-- ============================================

COMMENT ON TABLE projects IS 'Organizes documents into logical project groupings for filtered RAG queries';
COMMENT ON TABLE tags IS 'Flexible labels that can be applied to any document';
COMMENT ON TABLE document_tags IS 'Junction table for document-tag many-to-many relationship';
COMMENT ON COLUMN documents.project_id IS 'Optional project assignment for document organization';
COMMENT ON COLUMN projects.document_count IS 'Denormalized count updated by trigger for performance';
COMMENT ON COLUMN tags.usage_count IS 'Denormalized count for sorting tags by popularity';

-- ============================================
-- 10. Migration Log
-- ============================================

INSERT INTO migrations_log (migration_name) 
VALUES ('004_lightweight_graphrag_v1')
ON CONFLICT DO NOTHING;
