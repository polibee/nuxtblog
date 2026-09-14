import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST,
  ADMIN_I18N_HARDCODED_COPY_ALLOWLIST,
  resolveAdminDisplayLabel
} from '../../app/admin/i18n/display-label'
import { useI18n } from '../../app/admin/i18n'
import { auditI18nUsage } from '../../scripts/audit-i18n-usage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin i18n rendering', () => {
  it('resolves registered admin enum values in both locales', () => {
    vi.stubGlobal('useCookie', () => ({ value: 'zh-CN' }))
    const { locale, t } = useI18n()

    expect(resolveAdminDisplayLabel(t, 'campaignStatus', 'pending_review')).toBe('待审核')
    expect(resolveAdminDisplayLabel(t, 'mediaUsage', 'post_featured')).toBe('文章封面')
    expect(resolveAdminDisplayLabel(t, 'aiSource', 'post')).toBe('文章')

    locale.value = 'en'
    expect(resolveAdminDisplayLabel(t, 'campaignStatus', 'pending_review')).toBe('Pending review')
    expect(resolveAdminDisplayLabel(t, 'mediaUsage', 'post_featured')).toBe('Post featured')
    expect(resolveAdminDisplayLabel(t, 'aiSource', 'post')).toBe('Post')
  })

  it('falls back to the supplied system value without exposing a generated i18n key', () => {
    vi.stubGlobal('useCookie', () => ({ value: 'en' }))
    const { t } = useI18n()

    expect(resolveAdminDisplayLabel(t, 'campaignStatus', 'future_status')).toBe('future_status')
    expect(resolveAdminDisplayLabel(t, 'aiTool', 'provider_health')).toBe('provider_health')
    expect(resolveAdminDisplayLabel(t, 'mediaUsage', undefined)).toBe('—')
    expect(resolveAdminDisplayLabel(t, 'mediaUsage', null)).toBe('—')
  })

  it('publishes finite allowlists for every dynamic translation domain', () => {
    expect(ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST['`res.aichat.source_${type}`']).toEqual(expect.arrayContaining([
      'res.aichat.source_post',
      'res.aichat.source_page',
      'res.aichat.source_product'
    ]))
    expect(ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST['`res.aichat.source_${type}`']).not.toContain('res.aichat.source_${type}')
    expect(Object.keys(ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST)).toContain('`editor.mode.${m}`')
    expect(ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST.key).toEqual(expect.arrayContaining([
      'res.adcampaigns.status.pending_review',
      'res.media.usage.post_featured'
    ]))
    expect(ADMIN_I18N_HARDCODED_COPY_ALLOWLIST).toEqual(expect.arrayContaining([
      'USD',
      'OpenAI',
      'ms',
      'nofollow',
      'SSL',
      '[paid]'
    ]))
  })

  it('keeps technical constants unchanged while translating surrounding copy', () => {
    vi.stubGlobal('useCookie', () => ({ value: 'zh-CN' }))
    const { t } = useI18n()

    expect(t('res.ai.providerOpenAI')).toBe('OpenAI')
    expect(t('res.ai.providerAnthropic')).toBe('Anthropic')
    expect(t('res.ai.unitMilliseconds')).toBe('ms')
    expect(t('res.ai.unitTokens')).toBe('tok')
    expect(t('res.media.formatWebp')).toBe('webp')
    expect(ADMIN_I18N_HARDCODED_COPY_ALLOWLIST).toContain('SSL')
  })

  it('provides bilingual feedback copy for permission, network, and save outcomes', () => {
    vi.stubGlobal('useCookie', () => ({ value: 'zh-CN' }))
    const { locale, t } = useI18n()
    const zh = [t('common.errors.forbidden'), t('common.errors.network'), t('common.saved')]

    locale.value = 'en'
    const en = [t('common.errors.forbidden'), t('common.errors.network'), t('common.saved')]

    expect(zh.every(value => value && !value.includes('.'))).toBe(true)
    expect(en.every(value => value && !value.includes('.'))).toBe(true)
    expect(zh).not.toEqual(en)
  })

  it('runs the repository audit with zero findings', async () => {
    const report = await auditI18nUsage({
      dynamicKeyAllowlist: ADMIN_I18N_DYNAMIC_KEY_ALLOWLIST,
      hardcodedCopyAllowlist: ADMIN_I18N_HARDCODED_COPY_ALLOWLIST
    })

    expect(report.findings).toHaveLength(0)
  })
})
