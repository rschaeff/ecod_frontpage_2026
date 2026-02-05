import { Pool, PoolClient, QueryResultRow } from 'pg';

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 */
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'asteria',
      port: parseInt(process.env.DB_PORT || '45000'),
      database: process.env.DB_NAME || 'ecod_af2_pdb',
      user: process.env.DB_USER || 'ecodweb',
      password: process.env.DB_PASSWORD,
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
    });

    // Log pool errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }
  return pool;
}

/**
 * Execute a type-safe database query
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<T[]> {
  const start = Date.now();
  const pool = getPool();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('DB Query:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
    }

    return result.rows;
  } catch (error) {
    console.error('Database query error:', {
      text: text.substring(0, 200),
      params,
      error,
    });
    throw error;
  }
}

/**
 * Execute a single query and return the first row or null
 */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connection health
 */
export async function healthCheck(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    await query('SELECT 1');
    return { ok: true, latency: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats(): {
  total: number;
  idle: number;
  waiting: number;
} {
  const pool = getPool();
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

/**
 * Gracefully close the pool (for cleanup)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
