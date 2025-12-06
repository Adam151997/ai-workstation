// app/api/setup/toolkits/route.ts
// Setup endpoint to create toolkit marketplace tables

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        // Execute each statement separately for better control

        // 1. Create toolkit_catalog table
        await query(`
            CREATE TABLE IF NOT EXISTS toolkit_catalog (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                composio_app_id VARCHAR(100) UNIQUE,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                icon_url TEXT,
                banner_url TEXT,
                category VARCHAR(50),
                tags TEXT[] DEFAULT '{}',
                tool_count INTEGER DEFAULT 0,
                available_actions JSONB DEFAULT '[]',
                available_triggers JSONB DEFAULT '[]',
                auth_type VARCHAR(50),
                auth_config JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                is_featured BOOLEAN DEFAULT false,
                is_official BOOLEAN DEFAULT true,
                install_count INTEGER DEFAULT 0,
                rating DECIMAL(2,1),
                documentation_url TEXT,
                support_url TEXT,
                pricing_info TEXT,
                last_synced_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // 2. Create user_toolkits table
        await query(`
            CREATE TABLE IF NOT EXISTS user_toolkits (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(255) NOT NULL,
                toolkit_id UUID REFERENCES toolkit_catalog(id) ON DELETE CASCADE,
                custom_name VARCHAR(255),
                custom_mcp_url TEXT,
                custom_config JSONB DEFAULT '{}',
                is_connected BOOLEAN DEFAULT false,
                connection_id VARCHAR(255),
                connected_account JSONB,
                enabled_actions TEXT[] DEFAULT '{}',
                disabled_actions TEXT[] DEFAULT '{}',
                last_used_at TIMESTAMPTZ,
                usage_count INTEGER DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pending',
                error_message TEXT,
                installed_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, toolkit_id),
                CHECK (toolkit_id IS NOT NULL OR custom_mcp_url IS NOT NULL)
            )
        `);

        // 3. Create toolkit_categories table
        await query(`
            CREATE TABLE IF NOT EXISTS toolkit_categories (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                icon VARCHAR(10),
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // 4. Insert categories
        const categories = [
            ['crm', 'CRM & Sales', 'Customer relationship management tools', '💼', 1],
            ['email', 'Email & Communication', 'Email and messaging platforms', '📧', 2],
            ['productivity', 'Productivity', 'Task management and collaboration', '✅', 3],
            ['social', 'Social Media', 'Social media management tools', '📱', 4],
            ['analytics', 'Analytics', 'Data and analytics platforms', '📊', 5],
            ['storage', 'Storage & Files', 'Cloud storage and file management', '📁', 6],
            ['development', 'Development', 'Developer tools and APIs', '💻', 7],
            ['finance', 'Finance', 'Accounting and payment tools', '💰', 8],
            ['marketing', 'Marketing', 'Marketing automation tools', '📈', 9],
            ['support', 'Customer Support', 'Help desk and support tools', '🎧', 10],
            ['hr', 'HR & Recruiting', 'Human resources tools', '👥', 11],
            ['custom', 'Custom', 'Custom MCP integrations', '🔧', 99],
        ];

        for (const [id, name, description, icon, order] of categories) {
            await query(`
                INSERT INTO toolkit_categories (id, name, description, icon, display_order)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
            `, [id, name, description, icon, order]);
        }

        // 5. Create indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_toolkit_catalog_category ON toolkit_catalog(category)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_toolkit_catalog_slug ON toolkit_catalog(slug)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_toolkit_catalog_active ON toolkit_catalog(is_active)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_user_toolkits_user ON user_toolkits(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_user_toolkits_status ON user_toolkits(status)`);

        // 6. Seed popular toolkits
        const toolkits = [
            ['HUBSPOT', 'HubSpot', 'hubspot', 'CRM platform for sales, marketing, and customer service', 'crm', 'https://cdn.worldvectorlogo.com/logos/hubspot.svg', 'oauth2', 45, true],
            ['SALESFORCE', 'Salesforce', 'salesforce', 'Enterprise CRM and business automation platform', 'crm', 'https://cdn.worldvectorlogo.com/logos/salesforce-2.svg', 'oauth2', 52, true],
            ['GMAIL', 'Gmail', 'gmail', 'Email service by Google', 'email', 'https://cdn.worldvectorlogo.com/logos/gmail-icon-1.svg', 'oauth2', 15, true],
            ['SLACK', 'Slack', 'slack', 'Team communication and collaboration platform', 'productivity', 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg', 'oauth2', 28, true],
            ['NOTION', 'Notion', 'notion', 'All-in-one workspace for notes, docs, and projects', 'productivity', 'https://cdn.worldvectorlogo.com/logos/notion-2.svg', 'oauth2', 22, true],
            ['GOOGLE_DRIVE', 'Google Drive', 'google-drive', 'Cloud storage and file sharing', 'storage', 'https://cdn.worldvectorlogo.com/logos/google-drive.svg', 'oauth2', 18, true],
            ['DROPBOX', 'Dropbox', 'dropbox', 'Cloud storage and file synchronization', 'storage', 'https://cdn.worldvectorlogo.com/logos/dropbox-1.svg', 'oauth2', 12, false],
            ['GITHUB', 'GitHub', 'github', 'Code hosting and collaboration platform', 'development', 'https://cdn.worldvectorlogo.com/logos/github-icon-1.svg', 'oauth2', 35, true],
            ['JIRA', 'Jira', 'jira', 'Project tracking for software teams', 'productivity', 'https://cdn.worldvectorlogo.com/logos/jira-1.svg', 'oauth2', 30, false],
            ['ASANA', 'Asana', 'asana', 'Work management and team collaboration', 'productivity', 'https://cdn.worldvectorlogo.com/logos/asana-logo.svg', 'oauth2', 25, false],
            ['TRELLO', 'Trello', 'trello', 'Visual project management with boards', 'productivity', 'https://cdn.worldvectorlogo.com/logos/trello.svg', 'oauth2', 18, false],
            ['GOOGLE_CALENDAR', 'Google Calendar', 'google-calendar', 'Calendar and scheduling service', 'productivity', 'https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png', 'oauth2', 12, true],
            ['LINKEDIN', 'LinkedIn', 'linkedin', 'Professional networking platform', 'social', 'https://cdn.worldvectorlogo.com/logos/linkedin-icon-2.svg', 'oauth2', 15, false],
            ['TWITTER', 'Twitter/X', 'twitter', 'Social media platform', 'social', 'https://cdn.worldvectorlogo.com/logos/twitter-6.svg', 'oauth2', 18, false],
            ['STRIPE', 'Stripe', 'stripe', 'Payment processing platform', 'finance', 'https://cdn.worldvectorlogo.com/logos/stripe-4.svg', 'api_key', 22, true],
            ['QUICKBOOKS', 'QuickBooks', 'quickbooks', 'Accounting software for businesses', 'finance', 'https://cdn.worldvectorlogo.com/logos/quickbooks-1.svg', 'oauth2', 20, false],
            ['ZENDESK', 'Zendesk', 'zendesk', 'Customer service and support platform', 'support', 'https://cdn.worldvectorlogo.com/logos/zendesk-1.svg', 'oauth2', 25, false],
            ['INTERCOM', 'Intercom', 'intercom', 'Customer messaging platform', 'support', 'https://cdn.worldvectorlogo.com/logos/intercom-1.svg', 'oauth2', 20, false],
            ['MAILCHIMP', 'Mailchimp', 'mailchimp', 'Email marketing and automation', 'marketing', 'https://cdn.worldvectorlogo.com/logos/mailchimp.svg', 'oauth2', 18, false],
            ['AIRTABLE', 'Airtable', 'airtable', 'Spreadsheet-database hybrid', 'productivity', 'https://cdn.worldvectorlogo.com/logos/airtable-1.svg', 'oauth2', 15, false],
        ];

        for (const [composio_app_id, name, slug, description, category, icon_url, auth_type, tool_count, is_featured] of toolkits) {
            await query(`
                INSERT INTO toolkit_catalog (composio_app_id, name, slug, description, category, icon_url, auth_type, tool_count, is_featured)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (slug) DO NOTHING
            `, [composio_app_id, name, slug, description, category, icon_url, auth_type, tool_count, is_featured]);
        }

        // Verify tables exist
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('toolkit_catalog', 'user_toolkits', 'toolkit_categories')
        `);

        // Count seeded data
        const toolkitCount = await query('SELECT COUNT(*) as count FROM toolkit_catalog');
        const categoryCount = await query('SELECT COUNT(*) as count FROM toolkit_categories');

        return NextResponse.json({
            success: true,
            message: 'Toolkit tables created successfully',
            tablesCreated: tables.map((t: any) => t.table_name),
            toolkitsSeeded: parseInt(toolkitCount[0].count),
            categoriesSeeded: parseInt(categoryCount[0].count),
        });

    } catch (error: any) {
        console.error('[Setup Toolkits] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create toolkit tables', details: error.message },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('toolkit_catalog', 'user_toolkits', 'toolkit_categories')
        `);

        const toolkitCount = await query('SELECT COUNT(*) as count FROM toolkit_catalog').catch(() => [{ count: 0 }]);
        const categoryCount = await query('SELECT COUNT(*) as count FROM toolkit_categories').catch(() => [{ count: 0 }]);

        return NextResponse.json({
            tablesExist: tables.map((t: any) => t.table_name),
            toolkitsSeeded: parseInt(toolkitCount[0]?.count || 0),
            categoriesSeeded: parseInt(categoryCount[0]?.count || 0),
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to check tables', details: error.message },
            { status: 500 }
        );
    }
}
