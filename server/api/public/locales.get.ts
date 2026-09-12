import { initBlogDb, isBlogDbReady } from '../../repositories/db.server'
import { listLocales } from '../../repositories/locale.repository'
import type { LocaleSummary } from '#shared/types/locale'

/** public locale registry (whitelisted fields only, no ids/flags beyond visibility) */
function toPublic(locale: LocaleSummary) {
  return {
    code: locale.code,
    name: locale.name,
    nativeName: locale.nativeName,
    urlPrefix: locale.urlPrefix,
    isDefault: locale.isDefault,
    contentEnabled: locale.contentEnabled,
    uiEnabled: locale.uiEnabled
  }
}

const DEGRADED = [{
  code: 'zh-CN',
  name: 'Simplified Chinese',
  nativeName: '简体中文',
  urlPrefix: '',
  isDefault: true,
  contentEnabled: true,
  uiEnabled: true
}]

export default defineEventHandler(async () => {
  await initBlogDb()
  if (!isBlogDbReady()) {
    return { locales: DEGRADED }
  }
  const locales = await listLocales({ enabledOnly: true })
  return { locales: locales.map(toPublic) }
})
