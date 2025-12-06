// app/api/setup/agent-memories/route.ts
// Migration: Agent memories table for cross-context memory
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const maxDuration = 300;

export async function GET() {
    try {
        console.log('[Setup] Running agent memories migration...');

        // Create agent_memories table (no foreign key - uses Clerk user IDs)
        await query(`
            CREATE TABLE IF NOT EXISTS agent_memories (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'context', 'decision', 'outcome')),
                content TEXT NOT NULL,
                source TEXT NOT NULL,
                relevance DECIMAL(3,2) DEFAULT 0.5 CHECK (relevance >= 0 AND relevance <= 1),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE
            );
        `);
        console.log('[Setup] ✅ Created agent_memories table');

        // Create indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_agent_memories_user_id ON agent_memories(user_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(type);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_agent_memories_source ON agent_memories(source);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_agent_memories_relevance ON agent_memories(relevance DESC);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_agent_memories_created_at ON agent_memories(created_at DESC);`);
        console.log('[Setup] ✅ Created basic indexes');

        // Composite index for common queries
        await query(`
            CREATE INDEX IF NOT EXISTS idx_agent_memories_user_relevance 
            ON agent_memories(user_id, relevance DESC, created_at DESC);
        `);
        console.log('[Setup] ✅ Created composite index');

        // Enable RLS
        await query(`ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;`);
        console.log('[Setup] ✅ Enabled RLS');

        // Create RLS policy (drop if exists first)
        await query(`DROP POLICY IF EXISTS agent_memories_user_isolation ON agent_memories;`);
        await query(`
            CREATE POLICY agent_memories_user_isolation ON agent_memories
                FOR ALL
                USING (user_id = current_setting('app.user_id', true))
                WITH CHECK (user_id = current_setting('app.user_id', true));
        `);
        console.log('[Setup] ✅ Created RLS policy');

        // Create updated_at trigger function
        await query(`
            CREATE OR REPLACE FUNCTION update_agent_memories_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create trigger
        await query(`DROP TRIGGER IF EXISTS trigger_agent_memories_updated_at ON agent_memories;`);
        await query(`
            CREATE TRIGGER trigger_agent_memories_updated_at
                BEFORE UPDATE ON agent_memories
                FOR EACH ROW
                EXECUTE FUNCTION update_agent_memories_timestamp();
        `);
        console.log('[Setup] ✅ Created updated_at trigger');

        // Verify table
        const tables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'agent_memories';
        `);

        const columns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'agent_memories'
            ORDER BY ordinal_position;
        `);

        console.log('[Setup] ✅ Agent memories migration complete!');

        return NextResponse.json({
            success: true,
            message: 'Agent memories migration completed successfully!',
            table: tables[0]?.table_name || 'agent_memories',
            columns: columns.map((c: any) => `${c.column_name} (${c.data_type})`),
            features: [
                'agent_memories table created',
                'Memory types: fact, preference, context, decision, outcome',
                'Relevance scoring (0-1)',
                'Indexes for fast querying',
                'Row Level Security enabled',
                'Auto-updated timestamps',
            ],
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Agent memories migration failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
                hint: 'Check if users table exists or if there are permission issues',
            },
            { status: 500 }
        );
    }
}
