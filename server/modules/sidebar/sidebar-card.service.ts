import { createError } from 'h3'
import type { Paginated } from '#shared/types/api'
import type { TranslationsRecord } from '#shared/types/locale'
import { sidebarCardInputSchema, type PublicSidebarCard, type SidebarCardInput } from '#shared/schemas/sidebar-card'
import { isBlogDbReady } from '../../repositories/db.server'
import { listLocales } from '../../repositories/locale.repository'
import {
  deleteCard,
  findCard,
  insertCard,
  listCards,
  updateCard,
  type SidebarCardRow,
  type TranslationRow
} from '../../repositories/sidebar-card.repository'
import { sanitizeRichText } from '../../utils/sanitize'
import { withCodeKeyedTranslations, withCodeKeyedTranslationsAll } from '../../utils/translations'

/* Sidebar card domain service. Splits translations[locale][field]
   writes into sidebar_cards + sidebar_card_translations inside one
   transaction; sanitizes rich-text before anything is stored. */

export interface AdminSidebarCard extends SidebarCardRow {
  /** preview title resolved from the default locale (or first available) */
  title: string
}

interface LocaleMaps {
  codeToId: Map<string, number>
  defaultCode: string
}

async function localeMaps(): Promise<LocaleMaps> {
  const locales = await listLocales()
  const codeToId = new Map(locales.map(l => [l.code, l.id]))
  const defaultLocale = locales.find(l => l.isDefault) ?? locales[0]
  return { codeToId, defaultCode: defaultLocale?.code ?? 'zh-CN' }
}

function previewTitle(translations: TranslationsRecord, defaultCode: string): string {
  return String(translations[defaultCode]?.title ?? Object.values(translations)[0]?.title ?? '')
}

function parseInput(body: unknown, partial: boolean): Partial<SidebarCardInput> {
  const schema = partial
    ? sidebarCardInputSchema.partial({ translations: true })
    : sidebarCardInputSchema
  const result = schema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 422, statusMessage: result.error.issues[0]?.message ?? 'Invalid input' })
  }
  return result.data
}

/** ad_slot stores a bare slot key (not rich text) in the content column */
function cardContent(type: string, content: string): string {
  return type === 'ad_slot' || type === 'article_toc'
    ? content.trim().slice(0, 100)
    : sanitizeRichText(content)
}

/** validate locale codes and build repository translation rows */
async function prepareTranslations(
  translations: NonNullable<SidebarCardInput['translations']> | undefined,
  codeToId: Map<string, number>,
  type: string
): Promise<TranslationRow[]> {
  if (!translations) return []
  const rows: TranslationRow[] = []
  for (const [code, fields] of Object.entries(translations)) {
    const localeId = codeToId.get(code)
    if (!localeId) {
      throw createError({ statusCode: 422, statusMessage: `Unknown locale "${code}"` })
    }
    rows.push({
      localeId,
      title: fields.title,
      content: cardContent(type, fields.content)
    })
  }
  return rows
}

export async function createSidebarCard(body: unknown): Promise<AdminSidebarCard> {
  const input = parseInput(body, false)
  const maps = await localeMaps()
  const type = input.type ?? 'html'
  const id = await insertCard(
    {
      type,
      linkUrl: input.linkUrl ?? null,
      imageMediaId: input.imageMediaId ?? null,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0
    },
    await prepareTranslations(input.translations, maps.codeToId, type)
  )
  const created = await findCard(id)
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Card disappeared after create' })
  const withCodes = await withCodeKeyedTranslations(created)
  return { ...withCodes, title: previewTitle(withCodes.translations, maps.defaultCode) }
}

export async function updateSidebarCard(id: number, body: unknown): Promise<AdminSidebarCard> {
  const existing = await findCard(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `Sidebar card #${id} not found` })
  }
  const input = parseInput(body, true)
  const maps = await localeMaps()
  await updateCard(
    id,
    {
      type: input.type,
      linkUrl: input.linkUrl,
      imageMediaId: input.imageMediaId,
      enabled: input.enabled,
      sortOrder: input.sortOrder
    },
    input.translations
      ? await prepareTranslations(input.translations, maps.codeToId, input.type ?? existing.type)
      : undefined
  )
  const updated = await findCard(id)
  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Card disappeared after update' })
  const withCodes = await withCodeKeyedTranslations(updated)
  return { ...withCodes, title: previewTitle(withCodes.translations, maps.defaultCode) }
}

export async function deleteSidebarCard(id: number): Promise<void> {
  const existing = await findCard(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `Sidebar card #${id} not found` })
  }
  await deleteCard(id)
}

export async function getSidebarCard(id: number): Promise<AdminSidebarCard> {
  const card = await findCard(id)
  if (!card) {
    throw createError({ statusCode: 404, statusMessage: `Sidebar card #${id} not found` })
  }
  const maps = await localeMaps()
  const withCodes = await withCodeKeyedTranslations(card)
  return { ...withCodes, title: previewTitle(withCodes.translations, maps.defaultCode) }
}

export async function listSidebarCards(query: { q?: string, page?: number, perPage?: number }): Promise<Paginated<AdminSidebarCard>> {
  const maps = await localeMaps()
  const cards: AdminSidebarCard[] = (await withCodeKeyedTranslationsAll(await listCards()))
    .map(card => ({ ...card, title: previewTitle(card.translations, maps.defaultCode) }))

  const term = query.q?.trim().toLowerCase()
  const filtered = term
    ? cards.filter(card =>
        card.title.toLowerCase().includes(term)
        || Object.values(card.translations).some(t => String(t.title ?? '').toLowerCase().includes(term))
      )
    : cards

  const page = Math.max(Number(query.page) || 1, 1)
  const perPage = Math.min(Math.max(Number(query.perPage) || 20, 1), 200)
  const total = filtered.length
  return {
    items: filtered.slice((page - 1) * perPage, page * perPage),
    total,
    page,
    perPage,
    totalPages: Math.max(Math.ceil(total / perPage), 1)
  }
}

/** public sidebar for ONE locale: enabled cards that have this locale's translation (no cross-locale fallback) */
export async function listPublicSidebarCards(localeCode: string): Promise<PublicSidebarCard[]> {
  const maps = await localeMaps()
  const localeId = maps.codeToId.get(localeCode)
  if (!localeId) return []
  const cards = await listCards()
  const mapped = await Promise.all(cards
    .filter(card => card.enabled)
    .map(async (card) => {
      /* author cards carry a config JSON, not per-locale copy — fully
         independent from the /profile module (user decision: the two
         are different things and must not share data) */
      if (card.type === 'author') {
        const config = (card.config ?? null) as Record<string, unknown> | null
        if (!config) return undefined
        let avatar: { url: string, alt: string } | null = null
        const avatarMediaId = Number(config.avatarMediaId) || 0
        if (avatarMediaId) {
          const { getMedia } = await import('../../repositories/media.repository')
          const media = await getMedia(avatarMediaId)
          if (media) avatar = { url: `/media/${media.storageKey}`, alt: String(config.displayName ?? '') }
        }
        const socials = Array.isArray(config.socialLinks)
          ? (config.socialLinks as Array<Record<string, unknown>>).slice(0, 5)
              .map(s => ({ platform: String(s.platform ?? 'custom'), url: String(s.url ?? ''), label: String(s.label ?? '') }))
              .filter(s => s.url)
          : []
        const ctaRaw = config.cta as Record<string, unknown> | null | undefined
        const cta = ctaRaw && typeof ctaRaw.url === 'string' && ctaRaw.url
          ? {
              label: String(ctaRaw.label ?? 'About Me'),
              url: ctaRaw.url,
              external: /^https?:\/\//i.test(ctaRaw.url)
            }
          : null
        return {
          id: card.id,
          type: 'author',
          title: 'author',
          content: '',
          sortOrder: card.sortOrder,
          linkUrl: null,
          author: {
            name: String(config.displayName ?? ''),
            headline: String(config.headline ?? ''),
            bio: String(config.bio ?? ''),
            avatar,
            avatarStyle: config.avatarStyle === 'rounded' ? 'rounded' : 'circle',
            layout: config.layout === 'compact' ? 'compact' : 'centered',
            socials,
            cta
          }
        }
      }
      const fields = card.translations[String(localeId)] as
        | { title?: unknown, content?: unknown }
        | undefined
      if (!fields || typeof fields.title !== 'string' || typeof fields.content !== 'string') return undefined
      const out: PublicSidebarCard = {
        id: card.id,
        type: card.type,
        title: fields.title,
        content: cardContent(card.type, fields.content),
        sortOrder: card.sortOrder,
        linkUrl: card.linkUrl
      }
      if (card.type === 'image_link' && card.imageMediaId) {
        const { getMedia } = await import('../../repositories/media.repository')
        const media = await getMedia(card.imageMediaId)
        out.imageUrl = media ? `/media/${media.storageKey}` : null
      }
      if (card.type === 'latest_posts') {
        const { listPublished } = await import('../../repositories/post.runtime.repository')
        const posts = await listPublished(localeId, { page: 1, perPage: 5 })
        out.items = posts.items.map(p => ({ title: p.title, alias: p.alias }))
      }
      if (card.type === 'membership_plans') {
        const { listPublishedPlans } = await import('../membership/membership.service')
        out.plans = await listPublishedPlans()
      }
      return out
    }))
  return mapped
    .filter((card): card is PublicSidebarCard => card !== undefined)
}

/** boot seed: one demo card so the public sidebar is not empty on first run */
export async function ensureDefaultSidebarCard(): Promise<void> {
  if (!isBlogDbReady()) return
  const cards = await listCards()
  if (cards.length === 0) {
    await createSidebarCard({
      type: 'html',
      enabled: true,
      sortOrder: 0,
      translations: {
        'zh-CN': {
          title: '关于本站',
          content: '<p>这是一个基于 NuxtAdmin 的博客框架示例站点，支持多语言内容与商城。</p><p><a href="/membership">查看会员计划 →</a></p>'
        }
      }
    })
  }
  if (!cards.some(c => c.type === 'latest_posts')) {
    await createSidebarCard({
      type: 'latest_posts',
      enabled: true,
      sortOrder: 20,
      translations: {
        'zh-CN': {
          title: '最新文章',
          content: '<p>自动显示最新发布的文章列表。</p>'
        }
      }
    })
  }
  if (!cards.some(c => c.type === 'membership_plans')) {
    await createSidebarCard({
      type: 'membership_plans',
      enabled: true,
      sortOrder: 30,
      translations: {
        'zh-CN': {
          title: '会员计划',
          content: '<p>开通会员，畅读全部付费内容。</p>'
        }
      }
    })
  }
  if (!cards.some(c => c.type === 'link')) {
    await createSidebarCard({
      type: 'link',
      enabled: true,
      sortOrder: 10,
      linkUrl: '/store',
      translations: {
        'zh-CN': {
          title: '在线商店',
          content: '<p>虚拟商品在线购买，支付后自动交付。</p>'
        }
      }
    })
  }
  if (!cards.some(c => c.type === 'article_toc')) {
    await createSidebarCard({
      type: 'article_toc',
      enabled: true,
      sortOrder: 0,
      translations: {
        'zh-CN': {
          title: '目录',
          content: '文章页显示当前文章目录，其他页面自动隐藏。'
        }
      }
    })
  }
  if (!cards.some(c => c.type === 'ad_slot')) {
    await createSidebarCard({
      type: 'ad_slot',
      enabled: true,
      sortOrder: 90,
      translations: {
        'zh-CN': {
          title: '广告位',
          content: 'sidebar-ad'
        }
      }
    })
  }
}
