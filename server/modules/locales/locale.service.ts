import { createError } from 'h3'
import { localeInputSchema, type LocaleInput } from '#shared/schemas/locale'
import { isBlogDbReady } from '../../repositories/db.server'
import {
  clearDefaultFlags,
  countContentLocales,
  deleteLocaleRow,
  findLocaleByCode,
  findDefaultLocale,
  insertLocale,
  listLocales,
  updateLocaleRow
} from '../../repositories/locale.repository'
import { invalidateLocaleCache } from '../../utils/locale'
import { invalidatePageCache } from '../../utils/pageCache'

/* Locale Registry domain service (P02). Guards: at most one default
   (generated-column unique key backs this up), content/ui enabled
   implies enabled, the default locale cannot be deleted or disabled,
   and registry writes drop the resolver cache + page cache. */

function parse(body: unknown, partial: boolean): Partial<LocaleInput> {
  const schema = partial ? localeInputSchema.partial() : localeInputSchema
  const result = schema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error.issues[0]?.message ?? 'Invalid input'
    })
  }
  return result.data
}

function normalize(input: Partial<LocaleInput>): {
  code?: string
  name?: string
  nativeName?: string
  urlPrefix?: string | null
  enabled?: boolean
  contentEnabled?: boolean
  uiEnabled?: boolean
  isDefault?: boolean
  sortOrder?: number
} {
  return {
    code: input.code?.trim(),
    name: input.name?.trim(),
    nativeName: input.nativeName?.trim(),
    urlPrefix: input.urlPrefix === undefined ? undefined : (input.urlPrefix || null),
    enabled: input.enabled,
    contentEnabled: input.contentEnabled,
    uiEnabled: input.uiEnabled,
    isDefault: input.isDefault,
    sortOrder: input.sortOrder
  }
}

export async function createLocale(body: unknown) {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const input = parse(body, false)
  if (!input.code || !input.name || !input.nativeName) {
    throw createError({ statusCode: 422, statusMessage: 'code, name and nativeName are required' })
  }
  const resolved = {
    enabled: input.enabled ?? true,
    contentEnabled: input.contentEnabled ?? false,
    uiEnabled: input.uiEnabled ?? false
  }
  if ((input.contentEnabled ?? false) && !resolved.enabled) {
    throw createError({ statusCode: 422, statusMessage: 'content_enabled requires enabled' })
  }
  if ((input.uiEnabled ?? false) && !resolved.enabled) {
    throw createError({ statusCode: 422, statusMessage: 'ui_enabled requires enabled' })
  }
  const existing = await findLocaleByCode(input.code)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `Locale "${input.code}" already exists` })
  }
  if (input.urlPrefix) {
    const all = await listLocales()
    if (all.some(l => l.urlPrefix === input.urlPrefix)) {
      throw createError({ statusCode: 409, statusMessage: `URL prefix "${input.urlPrefix}" already exists` })
    }
  }
  if (input.isDefault) {
    await clearDefaultFlags()
  } else if ((await countContentLocales()) === 0 && !resolved.contentEnabled) {
    // keep at least one usable content locale in the registry
    throw createError({ statusCode: 422, statusMessage: 'At least one content-enabled locale must exist' })
  }

  try {
    await insertLocale({
      code: input.code,
      name: input.name,
      nativeName: input.nativeName,
      urlPrefix: input.urlPrefix || null,
      enabled: resolved.enabled,
      contentEnabled: resolved.contentEnabled,
      uiEnabled: resolved.uiEnabled,
      isDefault: input.isDefault ?? false,
      sortOrder: input.sortOrder ?? 0
    })
    invalidateLocaleCache()
    await invalidatePageCache()
    const created = await findLocaleByCode(input.code)
    return created
  } catch (e: unknown) {
    throw mapDbError(e)
  }
}

export async function updateLocale(id: number, body: unknown) {
  const all = await listLocales()
  const target = all.find(l => l.id === id)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: `Locale #${id} not found` })
  }
  const input = parse(body, true)
  const resolved = {
    enabled: input.enabled ?? target.enabled,
    contentEnabled: input.contentEnabled ?? target.contentEnabled,
    uiEnabled: input.uiEnabled ?? target.uiEnabled
  }
  if (resolved.contentEnabled && !resolved.enabled) {
    throw createError({ statusCode: 422, statusMessage: 'content_enabled requires enabled' })
  }
  if (resolved.uiEnabled && !resolved.enabled) {
    throw createError({ statusCode: 422, statusMessage: 'ui_enabled requires enabled' })
  }
  if (target.isDefault && (input.isDefault === false || (input.enabled === false))) {
    throw createError({ statusCode: 409, statusMessage: 'The default locale cannot be disabled or lose default status' })
  }
  if (input.code && input.code !== target.code) {
    const existing = await findLocaleByCode(input.code)
    if (existing) {
      throw createError({ statusCode: 409, statusMessage: `Locale "${input.code}" already exists` })
    }
  }
  if (input.urlPrefix) {
    const dup = all.some(l => l.urlPrefix === input.urlPrefix && l.id !== id)
    if (dup) {
      throw createError({ statusCode: 409, statusMessage: `URL prefix "${input.urlPrefix}" already exists` })
    }
  }
  if (input.isDefault) {
    await clearDefaultFlags()
  }
  if ((await countContentLocales()) === 1 && target.contentEnabled && input.contentEnabled === false) {
    throw createError({ statusCode: 422, statusMessage: 'At least one content-enabled locale must exist' })
  }

  try {
    await updateLocaleRow(id, normalize(input))
    invalidateLocaleCache()
    await invalidatePageCache()
    return (await listLocales()).find(l => l.id === id)
  } catch (e: unknown) {
    throw mapDbError(e)
  }
}

export async function deleteLocale(id: number): Promise<void> {
  const target = (await listLocales()).find(l => l.id === id)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: `Locale #${id} not found` })
  }
  if (target.isDefault) {
    throw createError({ statusCode: 409, statusMessage: 'The default locale cannot be deleted' })
  }
  await deleteLocaleRow(id)
  invalidateLocaleCache()
  await invalidatePageCache()
}

export { listLocales as listRegistryLocales, findDefaultLocale }

export { findLocaleById as getLocaleById } from '../../repositories/locale.repository'
// re-exported for the admin detail endpoint

function mapDbError(e: unknown): never {
  const err = e as { code?: string, message?: string }
  if (err.code === 'ER_DUP_ENTRY') {
    const message = err.message?.includes('default_flag')
      ? 'Only one default locale is allowed'
      : 'Locale code or URL prefix already exists'
    throw createError({ statusCode: 409, statusMessage: message })
  }
  throw createError({ statusCode: 500, statusMessage: err.message ?? 'Locale write failed' })
}
