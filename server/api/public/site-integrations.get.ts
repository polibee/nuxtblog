import { getSettingValue } from '../../modules/settings/settings.service'

function clean(value: string | number | boolean, max: number): string {
  return String(value ?? '').replace(/\r/g, '').slice(0, max).trim()
}

/** Public integration metadata. These values are intentionally public because
 * verification and analytics snippets must be rendered in the document. */
export default defineEventHandler(async () => ({
  analyticsEnabled: Boolean(await getSettingValue('seo.analytics_enabled', false)),
  analyticsHeadCode: clean(await getSettingValue('seo.analytics_head_code', ''), 12000),
  webmaster: {
    google: clean(await getSettingValue('seo.webmaster_google', ''), 200),
    bing: clean(await getSettingValue('seo.webmaster_bing', ''), 200),
    baidu: clean(await getSettingValue('seo.webmaster_baidu', ''), 200)
  },
  adVerificationCode: clean(await getSettingValue('seo.ad_verification_code', ''), 12000)
}))
