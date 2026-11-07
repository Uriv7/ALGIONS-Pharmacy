/**
 * ALGIONS Pharmacy - Database Client Abstraction
 * Supports SQLite (offline primary workstation & embedded runtime) and PostgreSQL (cloud multi-counter).
 */

import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

export interface IDatabase {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
  transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  isPostgres(): boolean;
}

/**
 * SQLite Implementation (Used by Primary Offline Workstation and local dev/test)
 */
export class SqliteDatabaseClient implements IDatabase {
  private db: DatabaseSync;

  constructor(filename: string = ':memory:') {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
  }

  isPostgres(): boolean {
    return false;
  }

  private normalizeSql(sql: string): string {
    // Convert PostgreSQL $1, $2, $3 syntax to SQLite indexed parameters ?1, ?2, ?3
    // Also strip FOR UPDATE which is not used in SQLite single-writer WAL
    return sql.replace(/\$(\d+)/g, '?$1').replace(/\s+FOR\s+UPDATE/gi, '');
  }

  private serializeParams(params?: unknown[]): unknown[] {
    if (!params) return [];
    return params.map((p) => {
      if (p === undefined) return null;
      if (typeof p === 'boolean') return p ? 1 : 0;
      if (typeof p === 'object' && p !== null && !(p instanceof Date)) {
        return JSON.stringify(p);
      }
      if (p instanceof Date) {
        return p.toISOString();
      }
      return p;
    });
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const normalized = this.normalizeSql(sql);
    const serialized = this.serializeParams(params);
    const stmt = this.db.prepare(normalized);
    const rows = stmt.all(...(serialized as (string | number | bigint | null)[])) as T[];
    return {
      rows,
      rowCount: rows.length,
    };
  }

  async queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
    const normalized = this.normalizeSql(sql);
    const serialized = this.serializeParams(params);
    const stmt = this.db.prepare(normalized);
    const info = stmt.run(...(serialized as (string | number | bigint | null)[]));
    return {
      rowCount: Number(info.changes),
    };
  }

  async transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = await callback(this);
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  loadSqlFile(filePath: string): void {
    const sql = fs.readFileSync(filePath, 'utf-8');
    // Split into statements and execute
    this.db.exec(sql);
  }
}

/**
 * PostgreSQL Implementation (Used by Cloud API in production)
 */
export class PostgresDatabaseClient implements IDatabase {
  private pool: pg.Pool;

  constructor(connectionStringOrConfig: string | pg.PoolConfig) {
    if (typeof connectionStringOrConfig === 'string') {
      this.pool = new pg.Pool({ connectionString: connectionStringOrConfig });
    } else {
      this.pool = new pg.Pool(connectionStringOrConfig);
    }
  }

  isPostgres(): boolean {
    return true;
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const res = await this.pool.query(sql, params);
    return {
      rows: res.rows as T[],
      rowCount: res.rowCount ?? res.rows.length,
    };
  }

  async queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
    const res = await this.query<T>(sql, params);
    return res.rows[0] ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
    const res = await this.pool.query(sql, params);
    return {
      rowCount: res.rowCount ?? 0,
    };
  }

  async transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txDb: IDatabase = {
        query: async <R = unknown>(sql: string, params?: unknown[]) => {
          const res = await client.query(sql, params);
          return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length };
        },
        queryOne: async <R = unknown>(sql: string, params?: unknown[]) => {
          const res = await client.query(sql, params);
          return (res.rows[0] as R) ?? null;
        },
        execute: async (sql: string, params?: unknown[]) => {
          const res = await client.query(sql, params);
          return { rowCount: res.rowCount ?? 0 };
        },
        transaction: async <SubT>(cb: (tx: IDatabase) => Promise<SubT>) => cb(txDb),
        close: async () => {},
        isPostgres: () => true,
      };
      const result = await callback(txDb);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Creates default database instance based on environment variables
 */
export function createDatabaseClient(dbPathOrUrl?: string): IDatabase {
  const url = dbPathOrUrl || process.env.DATABASE_URL;
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    return new PostgresDatabaseClient(url);
  }
  const sqliteFile = dbPathOrUrl || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'algions_pharmacy.sqlite');
  return new SqliteDatabaseClient(sqliteFile);
}
