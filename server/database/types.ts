export type DatabaseDriver = 'memory' | 'mysql' | 'postgres' | 'supabase'
export type OrmDriver = 'memory' | 'mysql' | 'postgres'

export interface DatabaseConfigInput {
  driver?: string
  url?: string
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean
  sslVerify?: boolean
  poolMax?: number
  connectTimeoutMs?: number
  queryTimeoutMs?: number
  allowMemoryFallback?: boolean
}

export interface DatabaseConfig {
  driver: DatabaseDriver
  ormDriver: OrmDriver
  url: string
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl: boolean
  sslVerify: boolean
  poolMax: number
  connectTimeoutMs: number
  queryTimeoutMs: number
  allowMemoryFallback: boolean
}

export interface DatabaseLogMeta {
  driver: DatabaseDriver
  ormDriver: OrmDriver
  host: string
  database: string
}
