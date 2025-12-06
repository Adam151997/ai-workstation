-- migrations/008_toolkits.sql
-- Toolkit Marketplace - User-installable tool integrations

-- ============================================
-- TOOLKIT CATALOG (synced from Composio)
-- ============================================

CREATE TABLE IF NOT EXISTS toolkit_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    composio_app_id VARCHAR(100) UNIQUE,  -- e.g., 'HUBSPOT', 'GMAIL', 'SLACK'
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    
    -- Display
    description TEXT,
    icon_url TEXT,
    banner_url TEXT,
    
    -- Categorization
    category VARCHAR(50),  -- 'crm', 'email', 'productivity', 'social', etc.
    tags TEXT[] DEFAULT '{}',
    
    -- Capabilities
    tool_count INTEGER DEFAULT 0,
    available_actions JSONB DEFAULT '[]',  -- List of action names
    available_triggers JSONB DEFAULT '[]', -- List of trigger names
    
    -- Auth
    auth_type VARCHAR(50),  -- 'oauth2', 'api_key', 'basic', 'none'
    auth_config JSONB DEFAULT '{}',  -- OAuth scopes, etc.
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_official BOOLEAN DEFAULT true,
    
    -- Stats
    install_count INTEGER DEFAULT 0,
    rating DECIMAL(2,1),
    
    -- Metadata
    documentation_url TEXT,
    support_url TEXT,
    pricing_info TEXT,
    
    -- Timestamps
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER TOOLKITS (installed by user)
-- ============================================

CREATE TABLE IF NOT EXISTS user_toolkits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    toolkit_id UUID REFERENCES toolkit_catalog(id) ON DELETE CASCADE,
    
    -- Custom MCP (if not from catalog)
    custom_name VARCHAR(255),
    custom_mcp_url TEXT,
    custom_config JSONB DEFAULT '{}',
    
    -- Connection status
    is_connected BOOLEAN DEFAULT false,
    connection_id VARCHAR(255),  -- Composio connection ID
    connected_account JSONB,  -- Account info from OAuth
    
    -- Permissions
    enabled_actions TEXT[] DEFAULT '{}',  -- Which actions user has enabled
    disabled_actions TEXT[] DEFAULT '{}', -- Explicitly disabled
    
    -- Usage
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'connected', 'error', 'disabled'
    error_message TEXT,
    
    -- Timestamps
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, toolkit_id),
    CHECK (toolkit_id IS NOT NULL OR custom_mcp_url IS NOT NULL)
);

-- ============================================
-- TOOLKIT CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS toolkit_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO toolkit_categories (id, name, description, icon, display_order) VALUES
    ('crm', 'CRM & Sales', 'Customer relationship management tools', '💼', 1),
    ('email', 'Email & Communication', 'Email and messaging platforms', '📧', 2),
    ('productivity', 'Productivity', 'Task management and collaboration', '✅', 3),
    ('social', 'Social Media', 'Social media management tools', '📱', 4),
    ('analytics', 'Analytics', 'Data and analytics platforms', '📊', 5),
    ('storage', 'Storage & Files', 'Cloud storage and file management', '📁', 6),
    ('development', 'Development', 'Developer tools and APIs', '💻', 7),
    ('finance', 'Finance', 'Accounting and payment tools', '💰', 8),
    ('marketing', 'Marketing', 'Marketing automation tools', '📈', 9),
    ('support', 'Customer Support', 'Help desk and support tools', '🎧', 10),
    ('hr', 'HR & Recruiting', 'Human resources tools', '👥', 11),
    ('custom', 'Custom', 'Custom MCP integrations', '🔧', 99)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_toolkit_catalog_category ON toolkit_catalog(category);
CREATE INDEX IF NOT EXISTS idx_toolkit_catalog_slug ON toolkit_catalog(slug);
CREATE INDEX IF NOT EXISTS idx_toolkit_catalog_active ON toolkit_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_user_toolkits_user ON user_toolkits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_toolkits_status ON user_toolkits(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_toolkits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own installed toolkits
CREATE POLICY user_toolkits_isolation ON user_toolkits
    FOR ALL USING (user_id = current_setting('app.user_id', true));

-- ============================================
-- SEED POPULAR TOOLKITS
-- ============================================

INSERT INTO toolkit_catalog (composio_app_id, name, slug, description, category, icon_url, auth_type, tool_count, is_featured) VALUES
    ('HUBSPOT', 'HubSpot', 'hubspot', 'CRM platform for sales, marketing, and customer service', 'crm', 'https://cdn.worldvectorlogo.com/logos/hubspot.svg', 'oauth2', 45, true),
    ('SALESFORCE', 'Salesforce', 'salesforce', 'Enterprise CRM and business automation platform', 'crm', 'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg', 'oauth2', 52, true),
    ('GMAIL', 'Gmail', 'gmail', 'Email service by Google', 'email', 'https://cdn.worldvectorlogo.com/logos/gmail-icon-1.svg', 'oauth2', 15, true),
    ('SLACK', 'Slack', 'slack', 'Team communication and collaboration platform', 'productivity', 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg', 'oauth2', 28, true),
    ('NOTION', 'Notion', 'notion', 'All-in-one workspace for notes, docs, and projects', 'productivity', 'https://cdn.worldvectorlogo.com/logos/notion-2.svg', 'oauth2', 22, true),
    ('GOOGLE_DRIVE', 'Google Drive', 'google-drive', 'Cloud storage and file sharing', 'storage', 'https://cdn.worldvectorlogo.com/logos/google-drive.svg', 'oauth2', 18, true),
    ('DROPBOX', 'Dropbox', 'dropbox', 'Cloud storage and file synchronization', 'storage', 'https://cdn.worldvectorlogo.com/logos/dropbox-1.svg', 'oauth2', 12, false),
    ('GITHUB', 'GitHub', 'github', 'Code hosting and collaboration platform', 'development', 'https://cdn.worldvectorlogo.com/logos/github-icon-1.svg', 'oauth2', 35, true),
    ('JIRA', 'Jira', 'jira', 'Project tracking for software teams', 'productivity', 'https://cdn.worldvectorlogo.com/logos/jira-1.svg', 'oauth2', 30, false),
    ('ASANA', 'Asana', 'asana', 'Work management and team collaboration', 'productivity', 'https://cdn.worldvectorlogo.com/logos/asana-logo.svg', 'oauth2', 25, false),
    ('TRELLO', 'Trello', 'trello', 'Visual project management with boards', 'productivity', 'https://cdn.worldvectorlogo.com/logos/trello.svg', 'oauth2', 18, false),
    ('GOOGLE_CALENDAR', 'Google Calendar', 'google-calendar', 'Calendar and scheduling service', 'productivity', 'https://cdn.worldvectorlogo.com/logos/google-calendar-1.svg', 'oauth2', 12, true),
    ('LINKEDIN', 'LinkedIn', 'linkedin', 'Professional networking platform', 'social', 'https://cdn.worldvectorlogo.com/logos/linkedin-icon-2.svg', 'oauth2', 15, false),
    ('TWITTER', 'Twitter/X', 'twitter', 'Social media platform', 'social', 'https://cdn.worldvectorlogo.com/logos/twitter-6.svg', 'oauth2', 18, false),
    ('STRIPE', 'Stripe', 'stripe', 'Payment processing platform', 'finance', 'https://cdn.worldvectorlogo.com/logos/stripe-4.svg', 'api_key', 22, true),
    ('QUICKBOOKS', 'QuickBooks', 'quickbooks', 'Accounting software for businesses', 'finance', 'https://cdn.worldvectorlogo.com/logos/quickbooks-1.svg', 'oauth2', 20, false),
    ('ZENDESK', 'Zendesk', 'zendesk', 'Customer service and support platform', 'support', 'https://cdn.worldvectorlogo.com/logos/zendesk-1.svg', 'oauth2', 25, false),
    ('INTERCOM', 'Intercom', 'intercom', 'Customer messaging platform', 'support', 'https://cdn.worldvectorlogo.com/logos/intercom-1.svg', 'oauth2', 20, false),
    ('MAILCHIMP', 'Mailchimp', 'mailchimp', 'Email marketing and automation', 'marketing', 'https://cdn.worldvectorlogo.com/logos/mailchimp.svg', 'oauth2', 18, false),
    ('AIRTABLE', 'Airtable', 'airtable', 'Spreadsheet-database hybrid', 'productivity', 'https://cdn.worldvectorlogo.com/logos/airtable-1.svg', 'oauth2', 15, false)
ON CONFLICT (slug) DO NOTHING;
