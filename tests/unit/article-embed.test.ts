import { describe, expect, it } from 'vitest'
import { normalizeArticleEmbeds } from '../../shared/utils/article-embed'

describe('article embeds', () => {
  it('normalizes markdown and BBCode images', () => {
    const html = normalizeArticleEmbeds('![cover](https://cdn.example.com/a.webp) [img]/media/a.webp[/img]')
    expect(html).toContain('<img src="https://cdn.example.com/a.webp" alt="cover">')
    expect(html).toContain('<img src="/media/a.webp">')
  })

  it('rejects unsafe image protocols and turns standalone HTTPS links into cards', () => {
    expect(normalizeArticleEmbeds('![x](javascript:alert(1))')).not.toContain('<img')
    const html = normalizeArticleEmbeds('https://example.com/docs')
    expect(html).toContain('class="article-embed article-embed-link"')
    expect(html).toContain('class="article-embed-action"')
    expect(html).not.toContain('>https://example.com/docs<')
  })

  it('turns a standalone X post URL into the common site card', () => {
    const html = normalizeArticleEmbeds('https://x.com/openai/status/123456789')
    expect(html).toContain('class="article-embed article-embed-link"')
    expect(html).toContain('<strong>x.com</strong>')
    expect(html).toContain('href="https://x.com/openai/status/123456789"')
    expect(html).toContain('Open link')
  })

  it('turns an inline X URL into the compact link card treatment', () => {
    const html = normalizeArticleEmbeds('Read this post: https://x.com/openai/status/123456789 today')
    expect(html).toContain('article-embed-inline')
    expect(html).toContain('href="https://x.com/openai/status/123456789"')
    expect(html).not.toContain('>https://x.com/openai/status/123456789<')
  })

  it('turns a standalone GitHub repository URL into the common site card', () => {
    const html = normalizeArticleEmbeds('https://github.com/nuxt/nuxt')
    expect(html).toContain('class="article-embed article-embed-link"')
    expect(html).toContain('<strong>github.com</strong>')
    expect(html).toContain('href="https://github.com/nuxt/nuxt"')
    expect(html).not.toContain('>https://github.com/nuxt/nuxt<')
  })

  it('turns an editor-generated paragraph link into the common site card', () => {
    const html = normalizeArticleEmbeds('<p><a href="https://github.com/polibee/nuxtblog">https://github.com/polibee/nuxtblog</a></p>')
    expect(html).toContain('article-embed-link')
    expect(html).toContain('<strong>github.com</strong>')
    expect(html).toContain('Open link')
  })

  it('migrates legacy provider-specific cards to the common site card', () => {
    const html = normalizeArticleEmbeds('<blockquote class="article-embed article-embed-github"><a href="https://example.com/docs">old label</a></blockquote>')
    expect(html).toContain('article-embed-link')
    expect(html).not.toContain('article-embed-github')
    expect(html).toContain('<strong>example.com</strong>')
  })
})
