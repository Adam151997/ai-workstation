// app/api/setup/database/route.ts - Run database migrations
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const maxDuration = 300;

export async function GET() {
  try {
    console.log('[Setup] Running database migration...');

    // Add artifact support columns
    await query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'upload',
      ADD COLUMN IF NOT EXISTS artifact_type VARCHAR(20),
      ADD COLUMN IF NOT EXISTS is_editable BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS artifact_content TEXT;
    `);

    // Update existing rows
    await query(`
      UPDATE documents 
      SET source_type = 'upload', 
          is_editable = false 
      WHERE source_type IS NULL;
    `);

    // Create index for filtering
    await query(`
      CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
    `);

    console.log('[Setup] ✅ Migration complete!');

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully!',
      changes: [
        'Added source_type column (upload/artifact)',
        'Added artifact_type column (document/table/chart)',
        'Added is_editable column',
        'Added artifact_content column',
        'Created index on source_type',
        'Updated existing documents'
      ]
    });

  } catch (error: any) {
    console.error('[Setup] ❌ Migration failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        hint: 'Check if columns already exist or if there are permission issues'
      },
      { status: 500 }
    );
  }
}
