// lib/db.ts - PostgreSQL Database Connection with RLS Support
import { Pool, PoolClient } from 'pg';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Railway
  },
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('[DB] ✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] ❌ Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a query with automatic connection management
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[DB] Query executed in ${duration}ms`);
    return res.rows;
  } catch (error) {
    console.error('[DB] Query error:', error);
    throw error;
  }
}

/**
 * Execute a query with RLS user context
 * Sets the current user before running the query
 */
export async function queryWithRLS<T = any>(
  text: string,
  params: any[] | undefined,
  userId: string
): Promise<T[]> {
  const client = await pool.connect();
  try {
    // Set the current user for RLS
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    
    const start = Date.now();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log(`[DB] RLS query executed in ${duration}ms for user ${userId.substring(0, 8)}...`);
    
    return res.rows;
  } catch (error) {
    console.error('[DB] RLS query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction with RLS
 */
export async function transactionWithRLS<T = any>(
  userId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Set the current user for RLS
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB] Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Get a client with RLS context already set
 */
export async function getClientWithRLS(userId: string): Promise<PoolClient> {
  const client = await pool.connect();
  await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
  return client;
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('[DB] Pool closed');
}

/**
 * Check if RLS is active and working
 */
export async function verifyRLS(): Promise<{
  enabled: boolean;
  tables: Array<{ table: string; rlsEnabled: boolean }>;
}> {
  try {
    const result = await query(`
      SELECT 
        tablename as table,
        rowsecurity as rls_enabled
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN (
        'documents', 'document_chunks', 'projects', 'tags', 'document_tags',
        'workflow_executions', 'workflow_steps', 'audit_logs', 
        'observability_metrics', 'billing_records'
      )
    `);
    
    const tables = result.map((r: any) => ({
      table: r.table,
      rlsEnabled: r.rls_enabled,
    }));
    
    const allEnabled = tables.every(t => t.rlsEnabled);
    
    return {
      enabled: allEnabled,
      tables,
    };
  } catch (error) {
    console.error('[DB] RLS verification error:', error);
    return {
      enabled: false,
      tables: [],
    };
  }
}

export default pool;
