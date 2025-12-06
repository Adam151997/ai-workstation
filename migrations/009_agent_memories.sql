-- Migration: 009_agent_memories.sql
-- Cross-context memory storage for agent system

-- Agent memories table (no foreign key - uses Clerk user IDs)
CREATE TABLE IF NOT EXISTS agent_memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'context', 'decision', 'outcome')),
    content TEXT NOT NULL,
    source TEXT NOT NULL, -- agent role that created this memory
    relevance DECIMAL(3,2) DEFAULT 0.5 CHECK (relevance >= 0 AND relevance <= 1),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- optional expiration
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_id ON agent_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_source ON agent_memories(source);
CREATE INDEX IF NOT EXISTS idx_agent_memories_relevance ON agent_memories(relevance DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_created_at ON agent_memories(created_at DESC);

-- Full text search index on content
CREATE INDEX IF NOT EXISTS idx_agent_memories_content_search 
ON agent_memories USING gin(to_tsvector('english', content));

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_relevance 
ON agent_memories(user_id, relevance DESC, created_at DESC);

-- Enable RLS
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY agent_memories_user_isolation ON agent_memories
    FOR ALL
    USING (user_id = current_setting('app.user_id', true))
    WITH CHECK (user_id = current_setting('app.user_id', true));

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_agent_memories_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_agent_memories_updated_at ON agent_memories;
CREATE TRIGGER trigger_agent_memories_updated_at
    BEFORE UPDATE ON agent_memories
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_memories_timestamp();

-- Function to clean expired memories
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS void AS $$
BEGIN
    DELETE FROM agent_memories 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE agent_memories IS 'Cross-context memory storage for AI agents';
COMMENT ON COLUMN agent_memories.type IS 'Memory type: fact, preference, context, decision, outcome';
COMMENT ON COLUMN agent_memories.source IS 'Agent role that created this memory';
COMMENT ON COLUMN agent_memories.relevance IS 'Relevance score 0-1, higher means more important';
