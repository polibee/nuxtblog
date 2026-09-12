import { z } from 'zod'

export const COMMENT_STATUSES = ['pending', 'approved', 'spam'] as const

export type CommentStatus = (typeof COMMENT_STATUSES)[number]

export const commentInputSchema = z
  .object({
    parentId: z.number().int().positive().nullish(),
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(255),
    content: z.string().trim().min(2).max(2000)
  })
  .strict()

export type CommentInput = z.infer<typeof commentInputSchema>

export interface PublicComment {
  id: number
  parentId: number | null
  authorName: string
  content: string
  createdAt: string
  children: PublicComment[]
}

/** admin-facing comment record (author email visible to moderators) */
export interface AdminComment {
  id: number
  postId: number
  postTitle: string
  parentId: number | null
  authorName: string
  authorEmail: string
  content: string
  status: CommentStatus
  createdAt: string
}
