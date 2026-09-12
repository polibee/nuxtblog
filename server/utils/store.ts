import { buildConnectionString, type DbConfig } from './runtimeConfig'

/* =============================================================
 * Storage adapter: persists the in-memory collections to SQL and
 * reloads them at boot. Two SQL dialects (PostgreSQL / MySQL) plus
 * the no-op memory driver. Supabase is PostgreSQL via its connection
 * string.
 *
 * SQL safety: every statement is a compile-time literal; every value
 * is bound through parameter placeholders ($n for pg, ? for mysql,
 * arrays via ANY()/tuple expansion). No value is ever concatenated
 * into SQL.
 *
 * Consistency model: single-node write-through. The in-memory
 * collections remain the serving layer; SQL provides durability.
 * Multi-instance deployment needs push-down queries (roadmap).
 * ============================================================= */

export interface StoreDriver {
  kind: 'memory' | 'postgres' | 'mysql' | 'supabase'
  init(): Promise<void>
  loadAll(): Promise<Array<{ resource: string, rows: Array<Record<string, unknown>> }>>
  upsert(resource: string, id: number, row: Record<string, unknown>): Promise<void>
  removeRows(resource: string, ids: number[]): Promise<void>
  ping(): Promise<void>
}

class MemoryStore implements StoreDriver {
  kind = 'memory' as const
  async init() {}
  async loadAll() {
    return []
  }

  async upsert() {}
  async removeRows() {}
  async ping() {}
}

class PostgresStore implements StoreDriver {
  kind: 'postgres' | 'supabase'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- driver ships its own optional types
  private client: any = null

  constructor(private config: DbConfig, kind: 'postgres' | 'supabase' = 'postgres') {
    this.kind = kind
  }

  async init(): Promise<void> {
    const pg = await import('pg')
    this.client = new pg.Client({
      connectionString: await buildConnectionString(this.config),
      ssl: this.config.ssl ? { rejectUnauthorized: this.config.sslVerify } : undefined
    })
    await this.client.connect()
    await this.client.query('CREATE TABLE IF NOT EXISTS cms_records (resource VARCHAR(80) NOT NULL, id BIGINT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (resource, id))', [])
    await this.client.query('CREATE TABLE IF NOT EXISTS cms_sequences (resource VARCHAR(80) PRIMARY KEY, last_id BIGINT NOT NULL DEFAULT 0)', [])
  }

  async loadAll() {
    const result = await this.client.query('SELECT resource, data FROM cms_records ORDER BY resource, id', [])
    const grouped = new Map<string, Array<Record<string, unknown>>>()
    for (const row of result.rows) {
      if (!grouped.has(row.resource)) grouped.set(row.resource, [])
      grouped.get(row.resource)!.push(row.data)
    }
    return [...grouped.entries()].map(([resource, rows]) => ({ resource, rows }))
  }

  async upsert(resource: string, id: number, row: Record<string, unknown>): Promise<void> {
    await this.client.query(
      'INSERT INTO cms_records (resource, id, data) VALUES ($1, $2, $3) ON CONFLICT (resource, id) DO UPDATE SET data = EXCLUDED.data',
      [resource, id, JSON.stringify(row)]
    )
    await this.client.query(
      'INSERT INTO cms_sequences (resource, last_id) VALUES ($1, $2) ON CONFLICT (resource) DO UPDATE SET last_id = GREATEST(cms_sequences.last_id, $2)',
      [resource, id]
    )
  }

  async removeRows(resource: string, ids: number[]): Promise<void> {
    if (ids.length === 0) return
    await this.client.query(
      'DELETE FROM cms_records WHERE resource = $1 AND id = ANY($2::bigint[])',
      [resource, ids]
    )
  }

  async ping(): Promise<void> {
    await this.client.query('SELECT 1', [])
  }
}

class MysqlStore implements StoreDriver {
  kind = 'mysql' as const
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- driver ships its own optional types
  private pool: any = null

  constructor(private config: DbConfig) {}

  async init(): Promise<void> {
    const mysql = await import('mysql2/promise')
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: process.env.DB_PASSWORD ?? '',
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: 5
    })
    await this.pool.query('CREATE TABLE IF NOT EXISTS cms_records (resource VARCHAR(80) NOT NULL, id BIGINT NOT NULL, data JSON NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (resource, id))', [])
    await this.pool.query('CREATE TABLE IF NOT EXISTS cms_sequences (resource VARCHAR(80) PRIMARY KEY, last_id BIGINT NOT NULL DEFAULT 0)', [])
  }

  async loadAll() {
    const [rows] = await this.pool.query('SELECT resource, data FROM cms_records ORDER BY resource, id', [])
    const grouped = new Map<string, Array<Record<string, unknown>>>()
    for (const row of rows as Array<{ resource: string, data: unknown }>) {
      if (!grouped.has(row.resource)) grouped.set(row.resource, [])
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      grouped.get(row.resource)!.push(data as Record<string, unknown>)
    }
    return [...grouped.entries()].map(([resource, rows]) => ({ resource, rows }))
  }

  async upsert(resource: string, id: number, row: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      'INSERT INTO cms_records (resource, id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
      [resource, id, JSON.stringify(row)]
    )
    await this.pool.query(
      'INSERT INTO cms_sequences (resource, last_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_id = GREATEST(last_id, VALUES(last_id))',
      [resource, id]
    )
  }

  async removeRows(resource: string, ids: number[]): Promise<void> {
    if (ids.length === 0) return
    await this.pool.query(
      'DELETE FROM cms_records WHERE resource = ? AND id IN (?)',
      [resource, ids]
    )
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1', [])
  }
}

/* ---------------- active driver holder ---------------- */

let active: StoreDriver = new MemoryStore()

export function activeStoreKind(): string {
  return active.kind
}

export async function initStore(config: DbConfig): Promise<string> {
  if (config.driver === 'postgres' || config.driver === 'supabase') {
    active = new PostgresStore(config, config.driver)
  } else if (config.driver === 'mysql') {
    active = new MysqlStore(config)
  } else {
    active = new MemoryStore()
  }
  await active.init()
  return active.kind
}

/** fire-and-forget persistence hooks (errors logged, never thrown) */
export function persistUpsert(resource: string, id: number, row: Record<string, unknown>): void {
  if (active.kind === 'memory') return
  active.upsert(resource, id, row).catch(e => console.error('[store] upsert failed:', (e as Error).message))
}

export function persistRemoval(resource: string, ids: number[]): void {
  if (active.kind === 'memory') return
  active.removeRows(resource, ids).catch(e => console.error('[store] delete failed:', (e as Error).message))
}

export async function loadPersisted(): Promise<Array<{ resource: string, rows: Array<Record<string, unknown>> }>> {
  return active.loadAll()
}

export async function testStoreConnection(config: DbConfig): Promise<{ ok: boolean, kind: string, error?: string }> {
  if (config.driver === 'memory') return { ok: true, kind: 'memory' }
  try {
    const probe = config.driver === 'mysql'
      ? new MysqlStore(config)
      : new PostgresStore(config, config.driver)
    await probe.init()
    await probe.ping()
    return { ok: true, kind: probe.kind }
  } catch (e: unknown) {
    return { ok: false, kind: config.driver, error: (e as Error).message }
  }
}
