// app/api/setup-db/route.ts - One-time database setup endpoint
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    console.log('[Setup] Starting database schema creation...');

    // Create documents table
    await query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        filename VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size INTEGER NOT NULL,
        file_data BYTEA NOT NULL,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        mode VARCHAR(50) DEFAULT 'Sales',
        
        CONSTRAINT documents_user_id_check CHECK (user_id IS NOT NULL),
        CONSTRAINT documents_filename_check CHECK (length(filename) > 0)
      );
    `);
    console.log('[Setup] ✅ Created documents table');

    // Create indexes for documents
    await query(`
      CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_documents_mode ON documents(mode);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);
    `);
    console.log('[Setup] ✅ Created indexes for documents');

    // Create document_chunks table
    await query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        pinecone_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT unique_document_chunk UNIQUE (document_id, chunk_index),
        CONSTRAINT chunk_index_positive CHECK (chunk_index >= 0)
      );
    `);
    console.log('[Setup] ✅ Created document_chunks table');

    // Create indexes for chunks
    await query(`
      CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_chunks_pinecone_id ON document_chunks(pinecone_id);
    `);
    console.log('[Setup] ✅ Created indexes for document_chunks');

    // Verify tables exist
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('documents', 'document_chunks');
    `);

    console.log('[Setup] ✅ Database setup complete!');
    console.log('[Setup] Tables created:', tables.map((t: any) => t.table_name));

    return NextResponse.json({
      success: true,
      message: 'Database schema created successfully!',
      tables: tables.map((t: any) => t.table_name),
    });

  } catch (error: any) {
    console.error('[Setup] ❌ Database setup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
