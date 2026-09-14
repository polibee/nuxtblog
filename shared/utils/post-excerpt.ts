/** Build a short card excerpt from the first meaningful paragraph of rich text. */
export function excerptFromContent(content: string, maxLength = 160): string {
  const source = String(content ?? '')
  const paragraph = source.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]
    ?? source.match(/<li\b[^>]*>([\s\S]*?)<\/li>/i)?.[1]
    ?? source
  const text = decodeEntities(
    paragraph
      .replace(/<\/?(?:strong|em|b|i|a|span|code|mark)\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, String.fromCharCode(34))
    .replace(/&#39;|&apos;/gi, String.fromCharCode(39))
}

export function resolvePostExcerpt(excerpt: string | null | undefined, content: string): string {
  const stored = String(excerpt ?? '').replace(/\s+/g, ' ').trim()
  return stored || excerptFromContent(content)
}
