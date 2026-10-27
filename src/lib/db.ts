import "server-only";
import pg from "pg";

// Postgres returns bigint / numeric as strings; ids and scores here are small.
pg.types.setTypeParser(20, (v) => Number(v)); // int8
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric

const globalForPool = globalThis as unknown as { pool?: pg.Pool };

// Reuse one pool across dev hot reloads.
export const pool =
  globalForPool.pool ??
  new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
globalForPool.pool = pool;

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool.query<T>(text, params);
  return rows;
}

export async function queryOne<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
