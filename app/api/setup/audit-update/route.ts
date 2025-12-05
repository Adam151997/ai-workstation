// app/api/setup/audit-update/route.ts
// Migration endpoint to add missing audit columns and documents.updated_at

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        console.log('[Migration] 🔄 Running audit schema update...');

        // 1. Add missing columns to audit_logs table
        console.log('[Migration] Adding action column...');
        await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100)`);
        
        console.log('[Migration] Adding resource column...');
        await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource VARCHAR(50)`);
        
        console.log('[Migration] Adding resource_id column...');
        await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(100)`);
        
        console.log('[Migration] Adding ip_address column...');
        await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100)`);
        
        console.log('[Migration] Adding user_agent column...');
        await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT`);

        // 2. Create indexes for new columns
        console.log('[Migration] Creating indexes...');
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action)`);

        // 3. Add updated_at to documents table
        console.log('[Migration] Adding updated_at to documents...');
        await query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);

        // 4. Create/update trigger for documents
        console.log('[Migration] Creating documents trigger...');
        await query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);
        
        await query(`DROP TRIGGER IF EXISTS update_documents_updated_at ON documents`);
        await query(`
            CREATE TRIGGER update_documents_updated_at
                BEFORE UPDATE ON documents
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
        `);

        // 5. Update existing NULL values
        console.log('[Migration] Updating existing rows...');
        await query(`UPDATE audit_logs SET action = action_type WHERE action IS NULL AND action_type IS NOT NULL`);
        await query(`UPDATE audit_logs SET resource = 'workflow' WHERE resource IS NULL AND execution_id IS NOT NULL`);
        await query(`UPDATE audit_logs SET ip_address = 'unknown' WHERE ip_address IS NULL`);
        await query(`UPDATE audit_logs SET user_agent = 'unknown' WHERE user_agent IS NULL`);
        await query(`UPDATE documents SET updated_at = uploaded_at WHERE updated_at IS NULL`);

        console.log('[Migration] ✅ Audit schema update complete!');

        return NextResponse.json({
            success: true,
            message: 'Audit schema update completed successfully',
            changes: [
                'Added audit_logs.action column',
                'Added audit_logs.resource column',
                'Added audit_logs.resource_id column',
                'Added audit_logs.ip_address column',
                'Added audit_logs.user_agent column',
                'Added documents.updated_at column',
                'Created indexes for new columns',
                'Created trigger for documents.updated_at',
            ],
        });

    } catch (error: any) {
        console.error('[Migration] ❌ Error:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: 'Migration failed', 
                details: error.message 
            },
            { status: 500 }
        );
    }
}
