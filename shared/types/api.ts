// Shared API contracts between app (client) and server (Nitro)

export interface ListQuery {
  q?: string
  page?: number
  perPage?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  filters?: Record<string, string>
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export type AdminRole = 'admin' | 'editor' | 'viewer'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: AdminRole
  permissions: string[]
}
