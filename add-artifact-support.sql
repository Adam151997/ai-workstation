-- Migration: Add artifact support to documents table
-- Run this in Railway or via setup endpoint

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'upload',
ADD COLUMN IF NOT EXISTS artifact_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_editable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS artifact_content TEXT;

-- Update existing rows
UPDATE documents 
SET source_type = 'upload', 
    is_editable = false 
WHERE source_type IS NULL;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);

-- Comments
COMMENT ON COLUMN documents.source_type IS 'Source of document: upload or artifact';
COMMENT ON COLUMN documents.artifact_type IS 'Type of artifact: document, table, or chart';
COMMENT ON COLUMN documents.is_editable IS 'Whether the document can be edited (true for artifacts)';
COMMENT ON COLUMN documents.artifact_content IS 'Original content for artifacts (JSON or text)';
