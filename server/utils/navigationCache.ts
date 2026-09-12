import { getKV } from './kv'
import { listLocales } from '../repositories/locale.repository'

/* Navigation cache keys (spec §11): navigation:{location}:{locale}.
   v1 invalidates on menu saves/deletes; content changes fall back to
   the 300s KV TTL (see navigation.service). */

export async function invalidateNavigationCache(location: string, locale: string): Promise<void> {
  await getKV().del(`navigation:${location}:${locale}`).catch(() => undefined)
}

export async function invalidateAllNavigationCaches(): Promise<void> {
  const locales = await listLocales().catch(() => [])
  for (const location of ['header', 'footer']) {
    for (const locale of locales) {
      await getKV().del(`navigation:${location}:${locale.code}`).catch(() => undefined)
    }
    await getKV().del(`navigation:${location}:zh-CN`).catch(() => undefined)
  }
}
