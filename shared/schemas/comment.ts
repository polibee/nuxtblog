import { z } from 'zod'

export const COMMENT_STATUSES = ['pending', 'approved', 'spam'] as const

export type CommentStatus = (typeof COMMENT_STATUSES)[number]

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || host.endsWith('.internal')) return true
  if (host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd')
    || host.startsWith('fe80:')) return true
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!ipv4) return false
  const octets = ipv4.slice(1).map(Number)
  if (octets.some(octet => octet > 255)) return true
  const first = octets[0] ?? 256
  const second = octets[1] ?? 256
  return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)
    || (first === 100 && second >= 64 && second <= 127) || first >= 224
}

export function isSafeCommentWebsite(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && !url.username && !url.password && Boolean(url.hostname) && !isPrivateOrLoopbackHost(url.hostname)
  } catch {
    return false
  }
}

const optionalWebsite = z.string().trim().max(500).refine(value => !value || isSafeCommentWebsite(value), {
  message: 'website must be a public http(s) URL'
}).nullish()

export const commentInputSchema = z
  .object({
    parentId: z.number().int().positive().nullish(),
    name: z.string().trim().min(1).max(80).optional(),
    email: z.string().trim().email().max(255).optional(),
    website: optionalWebsite,
    turnstileToken: z.string().trim().max(2048).optional(),
    content: z.string().trim().min(2).max(3000)
  })
  .strict()

export type CommentInput = z.infer<typeof commentInputSchema>

export const commentReplySchema = z
  .object({
    content: z.string().trim().min(2).max(3000)
  })
  .strict()

export type CommentReplyInput = z.infer<typeof commentReplySchema>

export interface PublicComment {
  id: number
  parentId: number | null
  authorName: string
  avatarUrl: string | null
  websiteUrl: string | null
  browserName: string | null
  browserVersion: string | null
  osName: string | null
  osVersion: string | null
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  badges: Array<{ key: string, name: string, description: string, icon: string, color: string }>
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
  userId: number | null
  authorName: string
  authorEmail: string
  content: string
  status: CommentStatus
  createdAt: string
}
