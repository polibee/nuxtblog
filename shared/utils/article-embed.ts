const SAFE_IMAGE_URL = /^(?:https:\/\/|\/)(?!\/)/i
const EXTERNAL_URL = /^https:\/\/[^\s<]+$/i

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function imageTag(url: string, alt = ''): string {
  const trimmed = url.trim()
  if (!SAFE_IMAGE_URL.test(trimmed)) return ''
  return `<img src="${escapeAttribute(trimmed)}"${alt.trim() ? ` alt="${escapeAttribute(alt.trim())}"` : ''}>`
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return 'External link'
  }
}

function cleanUrl(url: string): string {
  return url.trim().replace(/[),.;!?]+$/u, '')
}

/** Render every external article URL with the same site-label/action treatment. */
function embedTag(url: string, inline = false): string {
  const trimmed = cleanUrl(url)
  if (!EXTERNAL_URL.test(trimmed)) return ''
  const host = escapeAttribute(hostLabel(trimmed))
  const href = escapeAttribute(trimmed)
  if (inline) {
    return `<a class="article-embed article-embed-inline" href="${href}" rel="noopener noreferrer nofollow" target="_blank"><span class="article-embed-icon" aria-hidden="true">↗</span><strong>${host}</strong><span aria-hidden="true">↗</span></a>`
  }
  return `<blockquote class="article-embed article-embed-link"><span class="article-embed-site"><span class="article-embed-icon" aria-hidden="true">↗</span><strong>${host}</strong></span><a class="article-embed-action" href="${href}" rel="noopener noreferrer nofollow" target="_blank">Open link <span aria-hidden="true">↗</span></a></blockquote>`
}

/** Convert supported lightweight image syntax and article URLs before sanitization. */
export function normalizeArticleEmbeds(content: string): string {
  let result = String(content ?? '')
  result = result.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/gi, (_, alt: string, url: string) => imageTag(url, alt))
  result = result.replace(/\[img\](https?:\/\/[^[]+|\/[^[]+)\[\/img\]/gi, (_, url: string) => imageTag(url))
  result = result.replace(/<blockquote\b[^>]*class=["'][^"']*article-embed-(?:github|x)[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["'](https:\/\/[^"']+)["'][^>]*>[\s\S]*?<\/a>[\s\S]*?<\/blockquote>/gi, (_, url: string) => embedTag(url))
  result = result.replace(/<p>\s*(https:\/\/[^\s<]+)\s*<\/p>/gi, (_, url: string) => embedTag(url))
  result = result.replace(/<p>\s*<a\b[^>]*href=["'](https:\/\/[^"']+)["'][^>]*>[^<]*<\/a>\s*<\/p>/gi, (_, url: string) => embedTag(url))
  result = result.replace(/(^|\n)[ \t]*(https:\/\/[^\s<]+)[ \t]*(?=\n|$)/g, (_, prefix: string, url: string) => `${prefix}${embedTag(url)}`)
  result = result.replace(/(^|[\s(])(https:\/\/[^\s<]+)/g, (_, prefix: string, url: string) => `${prefix}${embedTag(url, true)}`)
  return result
}
