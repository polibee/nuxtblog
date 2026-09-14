import sanitizeHtml from 'sanitize-html'

/* =============================================================
 * Server-side whitelist sanitizer for rich-text (HTML) content.
 * Applied to every richtext field before it reaches the store,
 * so stored HTML can be rendered safely by the frontend/theme.
 * ============================================================= */

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
    'h2', 'h3', 'ul', 'ol', 'li', 'hr',
    'a', 'img', 'span',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'mark'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'class'],
    img: ['src', 'alt', 'title'],
    span: ['style', 'data-type', 'class'],
    blockquote: ['class'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    p: ['style', 'data-placeholder'],
    mark: ['style']
  },
  allowedStyles: {
    '*': { 'text-align': [/^(left|center|right|justify)$/], 'color': [/^#[0-9a-fA-F]{3,8}$/] }
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['https']
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' })
  },
  disallowedTagsMode: 'discard'
}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(String(html ?? ''), OPTIONS)
}
