import { eq } from 'drizzle-orm'
import { isBlogDbReady, getDb } from '../../repositories/db.server'
import { adCampaigns, adCreatives, adCreativeTranslations, adPlacements, adSlots } from '../../repositories/schema/advertising'
import { listLocales } from '../../repositories/locale.repository'

const AD_SLOTS = [{ key: 'sidebar-ad', name: 'Sidebar ad' }, { key: 'post-bottom', name: 'Post bottom ad' }]

/* P17 boot seed (impl doc §8): register built-in slots, plus one demo
   campaign (image creative pointing at /membership) so the sidebar ad
   renders on first run. Idempotent per key/alias. */

export async function ensureDefaultAdContent(): Promise<void> {
  if (!isBlogDbReady()) return
  const db = getDb()

  for (const slot of AD_SLOTS) {
    const [existing] = await db.select({ id: adSlots.id }).from(adSlots).where(eq(adSlots.key, slot.key)).limit(1)
    if (!existing) {
      await db.insert(adSlots).values({ key: slot.key, name: slot.name })
    }
  }

  const [campaign] = await db.select({ id: adCampaigns.id }).from(adCampaigns).limit(1)
  if (campaign) return

  const [created] = await db.insert(adCampaigns).values({
    name: 'Demo · Membership promo',
    status: 'active'
  })
  const campaignId = created!.insertId

  const [creative] = await db.insert(adCreatives).values({
    campaignId,
    provider: 'image',
    weight: 1
  })
  const creativeId = creative!.insertId

  const locales = await listLocales()
  for (const locale of locales) {
    const title = locale.code === 'en'
      ? 'Become a member'
      : '开通会员'
    const content = locale.code === 'en'
      ? 'Read all members & paid content ad-free.'
      : '畅读全部会员与付费内容，会员免广告。'
    const buttonText = locale.code === 'en' ? 'Subscribe' : '立即开通'
    await db.insert(adCreativeTranslations).values({
      creativeId,
      localeId: locale.id,
      title,
      content,
      buttonText,
      targetUrl: '/membership'
    })
  }

  await db.insert(adPlacements).values({
    slotKey: 'sidebar-ad',
    campaignId,
    priority: 0
  })
}
