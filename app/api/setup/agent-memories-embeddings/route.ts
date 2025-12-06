// app/api/setup/agent-memories-embeddings/route.ts
// Migration: Add embedding support to agent memories
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const maxDuration = 300;

export async function GET() {
    try {
        console.log('[Setup] Adding embedding support to agent memories...');

        // Check if pgvector extension exists, if not we'll use a JSONB column for embeddings
        // Railway PostgreSQL may not have pgvector, so we use JSONB as fallback
        let useVector = false;
        
        try {
            await query(`CREATE EXTENSION IF NOT EXISTS vector;`);
            useVector = true;
            console.log('[Setup] ✅ pgvector extension enabled');
        } catch (e) {
            console.log('[Setup] ⚠️ pgvector not available, using JSONB for embeddings');
        }

        // Add embedding column (JSONB fallback if vector not available)
        if (useVector) {
            await query(`
                ALTER TABLE agent_memories 
                ADD COLUMN IF NOT EXISTS embedding vector(1536);
            `);
        } else {
            await query(`
                ALTER TABLE agent_memories 
                ADD COLUMN IF NOT EXISTS embedding JSONB;
            `);
        }
        console.log('[Setup] ✅ Added embedding column');

        // Add embedding_model column to track which model was used
        await query(`
            ALTER TABLE agent_memories 
            ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small';
        `);
        console.log('[Setup] ✅ Added embedding_model column');

        // Create index for faster lookups (only if using vector)
        if (useVector) {
            try {
                await query(`
                    CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding 
                    ON agent_memories USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 100);
                `);
                console.log('[Setup] ✅ Created vector similarity index');
            } catch (e) {
                console.log('[Setup] ⚠️ Could not create vector index (table may be empty)');
            }
        }

        // Verify columns
        const columns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'agent_memories'
            ORDER BY ordinal_position;
        `);

        console.log('[Setup] ✅ Agent memories embedding migration complete!');

        return NextResponse.json({
            success: true,
            message: 'Embedding support added to agent memories',
            vectorEnabled: useVector,
            columns: columns.map((c: any) => `${c.column_name} (${c.data_type})`),
        });

    } catch (error: any) {
        console.error('[Setup] ❌ Migration failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            { status: 500 }
        );
    }
}
