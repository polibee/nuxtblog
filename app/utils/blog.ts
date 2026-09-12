export { readingMinutes } from '#shared/utils/reading'
export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

function headingText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '') || 'section'
}

/** h2/h3 table of contents + the same HTML with stable heading ids injected */
export function extractToc(html: string): { toc: TocItem[], html: string } {
  const used = new Map<string, number>()
  const toc: TocItem[] = []
  const out = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g, (match, levelStr: string, attrs: string, inner: string) => {
    const level = Number(levelStr) as 2 | 3
    const existingId = attrs.match(/\bid=["']([^"']+)["']/)?.[1]
    if (existingId) {
      toc.push({ id: existingId, text: headingText(inner), level })
      return match
    }
    const text = headingText(inner)
    if (!text) return match
    const base = slugifyHeading(text)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    toc.push({ id, text, level })
    return `<h${level} id="${id}"${attrs}>${inner}</h${level}>`
  })
  return { toc, html: out }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatViews(views: number): string {
  if (views >= 1000) return `${(views / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(views)
}

/* split text into matched/unmatched segments for search-term highlighting */
export function splitHighlight(text: string, term: string): Array<{ text: string, hit: boolean }> {
  const trimmed = term.trim()
  if (!trimmed) return [{ text, hit: false }]
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text
    .split(new RegExp(`(${escaped})`, 'gi'))
    .filter(part => part !== '')
    .map(part => ({ text: part, hit: part.toLowerCase() === trimmed.toLowerCase() }))
}
