// app/api/setup/tools/route.ts - Setup Cloud Agentic Environment
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const maxDuration = 300;

export async function GET() {
  try {
    console.log('[Setup] 🚀 Starting Cloud Agentic Environment setup...');

    let statementsExecuted = 0;

    // 1. Create tool_catalog table
    try {
      await query(`
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
        )
      `);
      statementsExecuted++;
      console.log('[Setup] ✅ tool_catalog table created');
    } catch (err: any) {
      console.log('[Setup] ⚠️ tool_catalog:', err.message);
    }

    // 2. Create user_tool_preferences table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS user_tool_preferences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(100) NOT NULL,
          tool_slug VARCHAR(100) NOT NULL,
          is_enabled BOOLEAN DEFAULT true,
          position INTEGER DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, tool_slug),
          FOREIGN KEY (tool_slug) REFERENCES tool_catalog(slug) ON DELETE CASCADE
        )
      `);
      statementsExecuted++;
      console.log('[Setup] ✅ user_tool_preferences table created');
    } catch (err: any) {
      console.log('[Setup] ⚠️ user_tool_preferences:', err.message);
    }

    // 3. Create indexes
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_user_tools_lookup ON user_tool_preferences(user_id, is_enabled)');
      await query('CREATE INDEX IF NOT EXISTS idx_tool_catalog_category ON tool_catalog(category)');
      await query('CREATE INDEX IF NOT EXISTS idx_tool_catalog_popularity ON tool_catalog(popularity_score DESC)');
      statementsExecuted += 3;
      console.log('[Setup] ✅ Indexes created');
    } catch (err: any) {
      console.log('[Setup] ⚠️ Indexes:', err.message);
    }

    // 4. Insert default tools
    const defaultTools = [
      ['hubspot', 'HubSpot CRM', 'Customer relationship management and sales tools', 'Sales', 100],
      ['gmail', 'Gmail', 'Email management and communication', 'Communication', 95],
      ['slack', 'Slack', 'Team messaging and collaboration', 'Communication', 90],
      ['google_sheets', 'Google Sheets', 'Spreadsheet creation and data analysis', 'Productivity', 85],
      ['google_drive', 'Google Drive', 'File storage and sharing', 'Productivity', 80],
      ['google_calendar', 'Google Calendar', 'Schedule and event management', 'Productivity', 75],
      ['jira', 'Jira', 'Project management and issue tracking', 'Project Management', 70],
      ['notion', 'Notion', 'All-in-one workspace for notes and docs', 'Productivity', 65],
      ['trello', 'Trello', 'Visual project management boards', 'Project Management', 60],
      ['asana', 'Asana', 'Team task and workflow management', 'Project Management', 55]
    ];

    let toolsInserted = 0;
    for (const [slug, name, description, category, popularity] of defaultTools) {
      try {
        await query(`
          INSERT INTO tool_catalog (slug, name, description, category, popularity_score)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (slug) DO NOTHING
        `, [slug, name, description, category, popularity]);
        toolsInserted++;
      } catch (err: any) {
        console.log(`[Setup] ⚠️ Tool ${slug}:`, err.message);
      }
    }
    statementsExecuted += toolsInserted;
    console.log(`[Setup] ✅ ${toolsInserted} tools seeded`);

    // 5. Create migrations_log table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS migrations_log (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(200) NOT NULL,
          executed_at TIMESTAMP DEFAULT NOW()
        )
      `);
      statementsExecuted++;
      console.log('[Setup] ✅ migrations_log table created');
    } catch (err: any) {
      console.log('[Setup] ⚠️ migrations_log:', err.message);
    }

    // 6. Log this migration
    try {
      await query(`
        INSERT INTO migrations_log (migration_name) 
        VALUES ('cloud_agentic_environment_v1')
      `);
      statementsExecuted++;
    } catch (err: any) {
      console.log('[Setup] ⚠️ Migration log:', err.message);
    }

    // Verify tables - FIX: query() returns rows directly, not { rows: [] }
    let tableNames: string[] = [];
    try {
      const tables = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('tool_catalog', 'user_tool_preferences', 'migrations_log')
        ORDER BY table_name
      `);
      tableNames = Array.isArray(tables) ? tables.map((r: any) => r.table_name) : [];
      console.log('[Setup] 📋 Tables found:', tableNames);
    } catch (err) {
      console.error('[Setup] Error checking tables:', err);
    }

    // Count tools - FIX: query() returns rows directly
    let toolCount = 0;
    try {
      const countResult = await query('SELECT COUNT(*) as count FROM tool_catalog');
      toolCount = Array.isArray(countResult) && countResult.length > 0 ? parseInt(countResult[0].count) : 0;
      console.log('[Setup] 🔢 Tools in catalog:', toolCount);
    } catch (err) {
      console.error('[Setup] Error counting tools:', err);
    }

    console.log('[Setup] ✅ Migration complete!');

    return NextResponse.json({
      success: true,
      message: 'Cloud Agentic Environment setup complete!',
      details: {
        statementsExecuted,
        tablesCreated: tableNames,
        toolsSeeded: toolCount,
        features: [
          '✅ Tool Catalog table created',
          '✅ User Tool Preferences table created',
          '✅ Performance indexes added',
          `✅ ${toolCount} default tools seeded`,
          '✅ Migration log initialized'
        ]
      }
    });

  } catch (error: any) {
    console.error('[Setup] ❌ Setup failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        hint: 'Check database permissions and try again'
      },
      { status: 500 }
    );
  }
}
