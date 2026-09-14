import { getSettingValue } from '../modules/settings/settings.service'

/** GET /robots.txt — editable rules with safe defaults and a canonical sitemap. */
export default defineEventHandler(async (event) => {
  const configured = String(await getSettingValue('seo.robots_txt', '')).trim()
  const siteUrl = String(await getSettingValue('site.url', '')).trim() || getRequestURL(event).origin
  const origin = siteUrl.replace(/\/+$/, '')
  const defaultRules = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /account',
    'Disallow: /api/',
    'Disallow: /search',
    `Sitemap: ${origin}/sitemap.xml`
  ].join('\n')
  const lines = (configured || defaultRules)
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => !/^\s*sitemap\s*:/i.test(line))
  lines.push(`Sitemap: ${origin}/sitemap.xml`)
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  return `${lines.join('\n').slice(0, 8000)}\n`
})
