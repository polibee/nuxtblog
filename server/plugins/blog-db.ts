import { initBlogDb } from '../repositories/db.server'
import { initPostgresBlogDb } from '../repositories/db-postgres.server'
import { ensureDefaultSidebarCard } from '../modules/sidebar/sidebar-card.service'
import { seedInitialAdmin, seedDemoAccount } from '../modules/users/user.service'
import { seedDefaultSettings, seedLocalizedSettings } from '../modules/settings/settings.runtime.service'
import { ensureDefaultNavigations } from '../modules/navigation/navigation.service'
import { seedDefaultGateways } from '../modules/payments/gateway-manager'
import { ensureDefaultPages } from '../modules/pages/default-pages'
import { ensureDefaultAdContent } from '../modules/advertising/ad-seed.service'
import { ensureDefaultSlider } from '../modules/slider/slider.service'
import { pruneSessions } from '../utils/auth'

/**
 * Boot the blog MySQL data layer: ensure database, run Drizzle
 * migrations, seed the default locale, settings, the initial admin
 * account and the first sidebar card. initBlogDb never throws -
 * failures are logged and blog features degrade instead of crashing.
 */
export default defineNitroPlugin(async () => {
  const postgres = process.env.DB_DRIVER === 'postgres' || process.env.DB_DRIVER === 'supabase'
  if (postgres) {
    if (await initPostgresBlogDb()) {
      try {
        await seedInitialAdmin()
        await seedDefaultSettings()
        await seedLocalizedSettings()
      } catch (e: unknown) {
        console.error('[blog-db] postgres settings seed failed:', (e as Error).message)
      }
    }
    return
  }
  if (await initBlogDb()) {
    const seeds = [
      ['admin', seedInitialAdmin],
      ['demo account', seedDemoAccount],
      ['settings', seedDefaultSettings],
      ['localized settings', seedLocalizedSettings],
      ['navigations', ensureDefaultNavigations],
      ['sidebar', ensureDefaultSidebarCard],
      ['payment gateways', seedDefaultGateways],
      ['default pages', ensureDefaultPages],
      ['ad content', ensureDefaultAdContent],
      ['default slider', ensureDefaultSlider]
    ] as const
    for (const [name, seed] of seeds) {
      try {
        await seed()
      } catch (e: unknown) {
        console.error(`[blog-db] ${name} seed failed:`, (e as Error).message)
      }
    }
    void pruneSessions()
  }
})
