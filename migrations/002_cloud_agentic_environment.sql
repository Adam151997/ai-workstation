-- Migration: Cloud Agentic Environment - Tool Catalog & User Preferences
-- Run via: http://localhost:3000/api/setup/tools

-- 1. Tool Catalog Table (Composio's full integration list)
CREATE TABLE IF NOT EXISTS tool_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  category VARCHAR(50),
  is_premium BOOLEAN DEFAULT false,
  requires_auth BOOLEAN DEFAULT true,
  popularity_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. User Tool Preferences Table (User's personalized toolkit)
CREATE TABLE IF NOT EXISTS user_tool_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL, -- Clerk userId
  tool_slug VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0, -- For ordering in UI
  notes TEXT, -- User's personal notes about the tool
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, tool_slug),
  FOREIGN KEY (tool_slug) REFERENCES tool_catalog(slug) ON DELETE CASCADE
);

-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_user_tools_lookup ON user_tool_preferences(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_tool_catalog_category ON tool_catalog(category);
CREATE INDEX IF NOT EXISTS idx_tool_catalog_popularity ON tool_catalog(popularity_score DESC);

-- 4. Comments for Documentation
COMMENT ON TABLE tool_catalog IS 'Master catalog of all available Composio integrations';
COMMENT ON TABLE user_tool_preferences IS 'User-specific tool selections for personalized workspace';
COMMENT ON COLUMN user_tool_preferences.position IS 'Display order in user UI (0-indexed)';
COMMENT ON COLUMN tool_catalog.popularity_score IS 'Usage count across all users for recommendations';

-- 5. Insert Default/Popular Tools (Optional - for first-time users)
INSERT INTO tool_catalog (slug, name, description, category, popularity_score) VALUES
  ('hubspot', 'HubSpot CRM', 'Customer relationship management and sales tools', 'Sales', 100),
  ('gmail', 'Gmail', 'Email management and communication', 'Communication', 95),
  ('slack', 'Slack', 'Team messaging and collaboration', 'Communication', 90),
  ('google_sheets', 'Google Sheets', 'Spreadsheet creation and data analysis', 'Productivity', 85),
  ('google_drive', 'Google Drive', 'File storage and sharing', 'Productivity', 80),
  ('calendar', 'Google Calendar', 'Schedule and event management', 'Productivity', 75),
  ('jira', 'Jira', 'Project management and issue tracking', 'Project Management', 70),
  ('notion', 'Notion', 'All-in-one workspace for notes and docs', 'Productivity', 65),
  ('trello', 'Trello', 'Visual project management boards', 'Project Management', 60),
  ('asana', 'Asana', 'Team task and workflow management', 'Project Management', 55)
ON CONFLICT (slug) DO NOTHING;

-- 6. Migration Log
CREATE TABLE IF NOT EXISTS migrations_log (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(200) NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO migrations_log (migration_name) VALUES ('cloud_agentic_environment_v1');
