import { createHash } from 'node:crypto'

/* P31 Fingerprint Service (缓存优化 §3/4): content fingerprints decide
   whether a cached AI artifact is still valid — NOT updated_at (a view
   count bump must not re-trigger analysis). */

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export type EntityFingerprints = {
  content: string
  seo?: string
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => (val === undefined ? null : val))
}

export function fingerprintPost(row: {
  title?: unknown
  excerpt?: unknown
  content?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
  category?: unknown
  tags?: unknown
}): EntityFingerprints {
  const base = { title: row.title, excerpt: row.excerpt, category: row.category, tags: row.tags }
  return {
    content: sha256(`post:${stableStringify(base)}:${String(row.content ?? '')}`),
    seo: sha256(`post-seo:${stableStringify({ title: row.title, seoTitle: row.seoTitle, seoDescription: row.seoDescription, excerpt: row.excerpt })}`)
  }
}

export function fingerprintPage(row: {
  title?: unknown
  content?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
}): EntityFingerprints {
  return {
    content: sha256(`page:${String(row.title ?? '')}:${String(row.content ?? '')}`),
    seo: sha256(`page-seo:${stableStringify({ title: row.title, seoTitle: row.seoTitle, seoDescription: row.seoDescription })}`)
  }
}

export function fingerprintProfile(bundle: {
  profile?: Record<string, unknown>
  socials?: unknown[]
  experiences?: unknown[]
  projects?: unknown[]
  skills?: unknown[]
  focusItems?: unknown[]
}): EntityFingerprints {
  const relevant = {
    profile: bundle.profile,
    socials: bundle.socials,
    experiences: bundle.experiences,
    projects: bundle.projects,
    skills: bundle.skills,
    focusItems: bundle.focusItems
  }
  return { content: sha256(`profile:${stableStringify(relevant)}`) }
}

export function fingerprintProduct(row: {
  title?: unknown
  description?: unknown
  priceMinor?: unknown
  status?: unknown
}): EntityFingerprints {
  return {
    content: sha256(`product:${stableStringify({ title: row.title, description: row.description, priceMinor: row.priceMinor })}`),
    seo: sha256(`product-seo:${stableStringify({ title: row.title, description: row.description })}`)
  }
}

/** Editor AI selection fingerprint — same text + same feature + same
    instruction is cacheable (§40: low hit rate, cheap to keep). */
export function fingerprintSelection(input: {
  feature: string
  text: string
  instruction?: string
  tone?: string
  translateLocale?: string
}): string {
  return sha256(`editor:${stableStringify(input)}`)
}
