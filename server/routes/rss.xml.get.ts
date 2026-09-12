import { withPageCache } from '../utils/pageCache'
import { buildRssChannel, toPlainText } from '../utils/xml'
import { getSettingValue } from '../modules/settings/settings.service'
import { getPublicPosts } from '../modules/posts/post.service'
import { resolveLocale, withLocaleKey } from '../utils/locale'
import { isBlogDbReady } from '../repositories/db.server'
import { contentUrl } from '../utils/contentUrl'

/**
 * GET /rss.xml — latest published posts as an RSS 2.0 feed (resolved
 * default locale). Channel metadata comes from public settings.
 */
export default defineEventHandler(async (event) => {
  const value = async (key: string, fallback: string): Promise<string> =>
    String(await getSettingValue(key, fallback))

  const origin = (await value('SITE_URL', '')) || getRequestURL(event).origin

  let items: Array<{ title: string, url: string, description: string, pubDate: string }> = []
  let localeCode = 'zh-CN'
  if (isBlogDbReady()) {
    const locale = await resolveLocale('/', getRequestHeader(event, 'accept-language'))
    localeCode = locale.code
    const { items: posts } = await getPublicPosts(locale.code, { perPage: 50 })
    items = posts.map(p => ({
      title: p.title,
      url: contentUrl('post', p.alias),
      description: p.excerpt || toPlainText(''),
      pubDate: p.publishedAt
    }))
  }

  const { body } = await withPageCache(withLocaleKey('rss', localeCode), async () => buildRssChannel(
    {
      title: await value('SITE_NAME', 'Nuxt Admin'),
      link: origin,
      description: await value('SITE_DESCRIPTION', 'Latest posts')
    },
    items
  ))
  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return body
})
