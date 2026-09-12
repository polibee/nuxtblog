import type { PostAccessType } from '../schemas/post'

export interface PublicTaxonomyTerm {
  name: string
  alias: string
}

export interface PublicPostSummary {
  alias: string
  title: string
  excerpt: string
  publishedAt: string
  coverUrl: string | null
  authorName?: string | null
  views?: number
  readingMinutes?: number
  categories: PublicTaxonomyTerm[]
  tags: PublicTaxonomyTerm[]
}

export interface PublicPostDetail extends PublicPostSummary {
  id: number
  content: string
  /* paywall (P15): locked=true means the [paid] block / members body is
     withheld; price drives the buy button on the article page */
  paidContent?: string | null
  locked?: boolean
  price?: { priceMinor: number, currency: string, productAlias: string } | null
  neighbors?: {
    prev: { alias: string, title: string } | null
    next: { alias: string, title: string } | null
  }
  seoTitle: string
  seoDescription: string
  noindex: boolean
  authorName?: string | null
  accessType: PostAccessType
  commentStatus: 'open' | 'closed'
}

export interface PublicPageDetail {
  title: string
  alias: string
  content: string
  seoTitle: string
  seoDescription: string
  noindex: boolean
  template: string
  publishedAt: string
}

export interface PublicArchiveItem {
  year: number
  month: number
  day: number
  title: string
  alias: string
}

export interface PublicPageSummary {
  alias: string
  title: string
}
