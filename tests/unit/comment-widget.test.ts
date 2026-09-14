import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'app/components/public/PostComments.vue'), 'utf8')
const nodeSource = readFileSync(resolve(process.cwd(), 'app/components/public/PostCommentNode.vue'), 'utf8')

describe('public comment Turnstile widget', () => {
  it('renders Cloudflare widget callbacks instead of a token text input', () => {
    expect(source).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js')
    expect(source).toContain('turnstile.render')
    expect(source).toContain('\'/api/public-settings\'')
    expect(source).toContain('\'comments.turnstile_site_key\'')
    expect(source).toContain('expired-callback')
    expect(source).toContain('error-callback')
    expect(source).toContain('turnstileToken.value = token')
    expect(source).toContain('turnstileToken.value = \'\'')
    expect(source).toContain('turnstileError')
    expect(source).toContain('if (!siteKey) return')
    expect(source).not.toMatch(/v-model="turnstileToken"/)
  })

  it('delegates reply nodes to a recursive renderer with indentation', () => {
    expect(source).toContain('PostCommentNode')
    expect(source).toContain(':indent-class="indentClass"')
  })

  it('restores the session before rendering guest-only fields', () => {
    expect(source).toContain('await auth.fetchMe()')
    expect(source).toContain('const authReady = ref(false)')
    expect(source).toContain('v-if="authReady && !auth.user"')
  })

  it('stops recursive reply rendering at depth three while preserving depth-aware indentation', () => {
    expect(nodeSource).toContain('depth < 3')
    expect(nodeSource).toContain(':depth="depth + 1"')
    expect(nodeSource).toContain('indentClass(depth + 1)')
  })
})
