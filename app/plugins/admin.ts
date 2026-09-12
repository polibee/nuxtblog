import type { Paginated } from '#shared/types/api'
import type { ContentTypeLike } from '~/modules/content-types/dynamic'
import { buildContentModule } from '~/modules/content-types/dynamic'
import adminPanel from '~/admin/panels/admin.panel'
import dashboardModule from '~/modules/dashboard/module'
import usersModule from '~/modules/users/module'
import postsModule from '~/modules/posts/module'
import ordersModule from '~/modules/orders/module'
import mediaModule from '~/modules/media/module'
import rolesModule from '~/modules/roles/module'
import contentTypesModule from '~/modules/content-types/module'
import revisionsModule from '~/modules/revisions/module'
import webhooksModule from '~/modules/webhooks/module'
import taxonomyModule from '~/modules/taxonomy/module'
import menusModule from '~/modules/navigation/module'
import settingsModule from '~/modules/settings/module'
import sidebarModule from '~/modules/sidebar/module'
import localesModule from '~/modules/locales/module'
import pagesModule from '~/modules/pages/module'
import commentsModule from '~/modules/comments/module'
import storeModule from '~/modules/store/module'
import analyticsModule from '~/modules/analytics/module'
import paymentsModule from '~/modules/payments/module'
import exportsModule from '~/modules/exports/module'
import membershipModule from '~/modules/membership/module'
import advertisingModule from '~/modules/advertising/module'
import sliderModule from '~/modules/slider/module'
import backupModule from '~/modules/backup/module'
import aiModule from '~/modules/ai/module'
import authorModule from '~/modules/author/module'
import friendLinksModule from '~/modules/friend-links/module'
import notificationsModule from '~/modules/notifications/module'

/**
 * Application composition root.
 * Registers the panel, static business modules and every runtime
 * content type created through the Content Type builder.
 */
export default defineNuxtPlugin(async () => {
  setPanel(adminPanel)

  const modules = [
    dashboardModule, usersModule, postsModule, ordersModule,
    mediaModule, rolesModule, contentTypesModule,
    revisionsModule, webhooksModule,
    taxonomyModule, menusModule, sidebarModule, localesModule,
    pagesModule, commentsModule, analyticsModule, storeModule, settingsModule,
    paymentsModule, exportsModule, membershipModule, advertisingModule,
    sliderModule, backupModule, aiModule, authorModule, friendLinksModule, notificationsModule
  ]
  for (const module of modules) {
    registerModule(module)
  }

  // dynamic content types (public to boot; reads need auth but the
  // fetch simply yields nothing for guests before login redirect)
  try {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const res = await $fetch<Paginated<ContentTypeLike & { id: number }>>('/api/admin/content-types', {
      query: { perPage: 200 },
      headers
    })
    for (const ct of res.items) {
      registerModule(buildContentModule(ct))
    }
  } catch {
    // guest session: dynamic types appear after sign-in
  }
})
