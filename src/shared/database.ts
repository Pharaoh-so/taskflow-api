/**
 * Database connection pool and query helpers.
 * All modules use this shared pool to avoid connection sprawl.
 */

import pg from "pg";
import { logger } from "./logger.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

/** Initialize the database connection pool. */
export function initDatabase(connectionString: string): pg.Pool {
	if (pool) return pool;

	pool = new Pool({
		connectionString,
		max: 20,
		idleTimeoutMillis: 30_000,
		connectionTimeoutMillis: 5_000,
	});

	pool.on("error", (err) => {
		logger.error("Unexpected database pool error", { error: err.message });
	});

	logger.info("Database pool initialized");
	return pool;
}

/** Get the active database pool. Throws if not initialized. */
export function getPool(): pg.Pool {
	if (!pool) {
		throw new Error("Database not initialized — call initDatabase() first");
	}
	return pool;
}

/** Execute a parameterized query and return rows. */
export async function query<T extends pg.QueryResultRow>(
	text: string,
	params?: unknown[],
): Promise<T[]> {
	const start = Date.now();
	const result = await getPool().query<T>(text, params);
	const duration = Date.now() - start;

	logger.debug("Query executed", {
		text: text.substring(0, 80),
		duration,
		rows: result.rowCount,
	});

	return result.rows;
}

/** Execute a query expecting exactly one row. Throws if zero or multiple. */
export async function queryOne<T extends pg.QueryResultRow>(
	text: string,
	params?: unknown[],
): Promise<T> {
	const rows = await query<T>(text, params);
	if (rows.length !== 1) {
		throw new Error(`Expected 1 row, got ${rows.length}`);
	}
	return rows[0];
}

/** Execute a query expecting zero or one row. */
export async function queryMaybe<T extends pg.QueryResultRow>(
	text: string,
	params?: unknown[],
): Promise<T | null> {
	const rows = await query<T>(text, params);
	return rows[0] ?? null;
}

/** Run a function inside a database transaction. */
export async function withTransaction<T>(
	fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
	const client = await getPool().connect();
	try {
		await client.query("BEGIN");
		const result = await fn(client);
		await client.query("COMMIT");
		return result;
	} catch (err) {
		await client.query("ROLLBACK");
		throw err;
	} finally {
		client.release();
	}
}

/** Gracefully close the pool. */
export async function closeDatabase(): Promise<void> {
	if (pool) {
		await pool.end();
		pool = null;
		logger.info("Database pool closed");
	}
}
