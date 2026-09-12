import { z } from 'zod'

export const userRoleSchema = z.enum(['admin', 'editor', 'viewer'])
export const userStatusSchema = z.enum(['active', 'inactive'])

export const userCreateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    name: z.string().trim().min(1).max(80),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    password: z.string().min(8).max(128)
  })
  .strict()

export const userUpdateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    password: z.string().min(8).max(128).optional()
  })
  .strict()

export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>

/** admin-facing user record: never includes the password hash */
export interface UserRecord {
  id: number
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}
