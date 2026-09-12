import * as mysql from './alias.mysql.repository'
import * as postgres from './alias.postgres.repository'

const usePostgres = process.env.DB_DRIVER === 'postgres' || process.env.DB_DRIVER === 'supabase'
const implementation = (usePostgres ? postgres : mysql) as typeof mysql

export const findRedirect = implementation.findRedirect
export const insertRedirect = implementation.insertRedirect
