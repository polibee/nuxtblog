import type { MailProvider } from '../../../utils/mail'
import { ALIYUN_REGIONS } from '../../../utils/mail'
import { requirePermission } from '../../../utils/auth'
import { invalidatePageCache } from '../../../utils/pageCache'
import {
  createSetting,
  getSettingItem,
  invalidateSettingsCache,
  updateSettingValue
} from '../../../modules/settings/settings.runtime.service'

interface ConfigBody {
  provider?: string
  fromName?: string
  fromAddress?: string
  smtp?: { host?: string, port?: number, secure?: boolean, user?: string, pass?: string }
  aliyun?: { region?: string, user?: string, pass?: string }
  resend?: { apiKey?: string }
}

/** upsert a settings row by key (creates with correct type metadata) */
async function upsertSetting(key: string, value: string | number | boolean, secret = false): Promise<void> {
  const existing = await getSettingItem(key)
  if (existing) {
    if (value !== '' && value !== undefined) await updateSettingValue(existing.id, value)
    return
  }
  await createSetting({
    key,
    value,
    type: secret ? 'secret' : 'string',
    group: 'Email',
    public: false,
    description: `Mail service configuration (${key})`
  })
}

/** POST /api/admin/mail/config — persist provider selection & credentials */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.edit')

  const body = await readBody<ConfigBody>(event)
  if (!body) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid request body' })
  }
  if (body.provider && !['smtp', 'aliyun', 'resend'].includes(body.provider)) {
    throw createError({ statusCode: 422, statusMessage: '"provider" must be smtp, aliyun or resend' })
  }
  // validate BEFORE any write, so rejected values never reach the store
  if (body.aliyun?.region && !ALIYUN_REGIONS[body.aliyun.region]) {
    throw createError({
      statusCode: 422,
      statusMessage: `"${body.aliyun.region}" is not a valid Aliyun region (cn-hangzhou, ap-southeast-1, us-east-1, eu-central-1)`
    })
  }

  // ensure every managed key exists once, then update the values that were sent
  const managed: Array<[string, string | number | boolean, string | number | boolean, boolean]> = [
    ['EMAIL_PROVIDER', String(body.provider ?? 'smtp'), 'smtp', false],
    ['EMAIL_FROM_NAME', String(body.fromName ?? ''), '', false],
    ['EMAIL_FROM_ADDRESS', String(body.fromAddress ?? ''), '', false],
    ['EMAIL_SMTP_HOST', String(body.smtp?.host ?? ''), '', false],
    ['EMAIL_SMTP_PORT', body.smtp?.port ?? 465, 465, false],
    ['EMAIL_SMTP_SECURE', body.smtp?.secure ?? true, true, false],
    ['EMAIL_SMTP_USER', String(body.smtp?.user ?? ''), '', false],
    ['EMAIL_SMTP_PASS', String(body.smtp?.pass ?? ''), '', true],
    ['EMAIL_ALIYUN_REGION', String(body.aliyun?.region ?? 'cn-hangzhou'), 'cn-hangzhou', false],
    ['EMAIL_ALIYUN_SMTP_USER', String(body.aliyun?.user ?? ''), '', false],
    ['EMAIL_ALIYUN_SMTP_PASS', String(body.aliyun?.pass ?? ''), '', true],
    ['EMAIL_RESEND_API_KEY', String(body.resend?.apiKey ?? ''), '', true]
  ]

  for (const [key, incoming, fallback, isSecret] of managed) {
    await upsertSetting(key, incoming === '' ? fallback : incoming, isSecret)
  }
  invalidateSettingsCache()

  await invalidatePageCache(['public-settings'])
  return { ok: true }
})

// referenced for typing only
export type { MailProvider }
