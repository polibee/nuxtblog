import { getCollection, listCollectionNames } from '../utils/db'
import { withPageCache } from '../utils/pageCache'
import { buildUrlSet, type SitemapUrl } from '../utils/xml'
import { getSettingValue } from '../modules/settings/settings.service'
import { getPublicPosts } from '../modules/posts/post.service'
import { listPublishedPages } from '../repositories/page.runtime.repository'
import { listLocales } from '../repositories/locale.repository'
import { resolveLocale, withLocaleKey } from '../utils/locale'
import { isBlogDbReady } from '../repositories/db.server'
import { contentUrl } from '../utils/contentUrl'

/**
 * GET /sitemap.xml — home + published posts (default locale,
 * noindex excluded) + published dynamic content entries.
 */
export default defineEventHandler(async (event) => {
  const siteUrl = String(await getSettingValue('SITE_URL', ''))
  const origin = siteUrl || getRequestURL(event).origin

  const urls: SitemapUrl[] = [{ loc: '/', changefreq: 'daily', priority: 1 }]

  let localeCode = 'zh-CN'
  if (isBlogDbReady()) {
    const locale = await resolveLocale('/', getRequestHeader(event, 'accept-language'))
    localeCode = locale.code
    const locales = await listLocales()
    const localeId = locales.find(l => l.code === locale.code)?.id
    if (localeId) {
      const { items: posts } = await getPublicPosts(locale.code, { perPage: 50 })
      for (const post of posts) {
        urls.push({
          loc: contentUrl('post', post.alias),
          lastmod: post.publishedAt,
          changefreq: 'weekly',
          priority: 0.8
        })
      }
      const pages = await listPublishedPages(localeId)
      for (const page of pages) {
        urls.push({
          loc: contentUrl('page', page.alias),
          lastmod: page.publishedAt?.toISOString() ?? new Date().toISOString(),
          changefreq: 'monthly',
          priority: 0.6
        })
      }
    }
  }

  for (const name of listCollectionNames()) {
    if (!name.startsWith('ct_')) continue
    const slug = name.slice(3)
    for (const row of getCollection(name)) {
      if (row.status !== 'published' || row.robots === 'noindex') continue
      urls.push({
        loc: `/${slug}/${row.id}`,
        lastmod: (row.publishedAt as string | null) ?? (row.createdAt as string),
        changefreq: 'weekly',
        priority: 0.6
      })
    }
  }

  const { body } = await withPageCache(withLocaleKey('sitemap', localeCode), async () => buildUrlSet(origin, urls))
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return body
})
