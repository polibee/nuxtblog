import { eq } from 'drizzle-orm'
import { isBlogDbReady, getDb } from '../../repositories/db.server'
import { adCampaigns, adCreatives, adCreativeTranslations, adPlacements, adSlots } from '../../repositories/schema/advertising'
import { listLocales } from '../../repositories/locale.repository'

const AD_SLOTS = [
  { key: 'sidebar-ad', name: 'Sidebar ad' },
  { key: 'home-feed', name: 'Home feed' },
  { key: 'post-top', name: 'Post top' },
  { key: 'post-bottom', name: 'Post bottom ad' },
  { key: 'footer-ad', name: 'Footer ad' }
]
const DEMO_CAMPAIGN_NAME = 'Demo · Membership promo'
const DEMO_AFFILIATE_CAMPAIGN_NAME = 'Demo · Creator toolkit'

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

  const [campaign] = await db
    .select({ id: adCampaigns.id })
    .from(adCampaigns)
    .where(eq(adCampaigns.name, DEMO_CAMPAIGN_NAME))
    .limit(1)
  const locales = await listLocales()
  if (!campaign) {
    const [created] = await db.insert(adCampaigns).values({
      name: DEMO_CAMPAIGN_NAME,
      status: 'active'
    })
    const campaignId = created!.insertId

    const [creative] = await db.insert(adCreatives).values({
      campaignId,
      provider: 'image',
      weight: 1
    })
    const creativeId = creative!.insertId

    for (const locale of locales) {
      const isEnglish = locale.code.toLowerCase().startsWith('en')
      await db.insert(adCreativeTranslations).values({
        creativeId,
        localeId: locale.id,
        title: isEnglish ? 'Become a member' : '开通会员',
        content: isEnglish ? 'Read all members & paid content ad-free.' : '畅读全部会员与付费内容，会员免广告。',
        buttonText: isEnglish ? 'Subscribe' : '立即开通',
        targetUrl: '/membership'
      })
    }

    await db.insert(adPlacements).values({
      slotKey: 'sidebar-ad',
      campaignId,
      priority: 0
    })
  }

  const [affiliateCampaign] = await db
    .select({ id: adCampaigns.id })
    .from(adCampaigns)
    .where(eq(adCampaigns.name, DEMO_AFFILIATE_CAMPAIGN_NAME))
    .limit(1)
  if (affiliateCampaign) return

  const [affiliateCreated] = await db.insert(adCampaigns).values({
    name: DEMO_AFFILIATE_CAMPAIGN_NAME,
    status: 'active'
  })
  const [affiliateCreative] = await db.insert(adCreatives).values({
    campaignId: affiliateCreated!.insertId,
    provider: 'affiliate',
    weight: 1
  })
  for (const locale of locales) {
    const isEnglish = locale.code.toLowerCase().startsWith('en')
    await db.insert(adCreativeTranslations).values({
      creativeId: affiliateCreative!.insertId,
      localeId: locale.id,
      title: isEnglish ? 'Build something worth sharing' : '做一个值得分享的作品',
      content: isEnglish ? 'A small toolkit for creators who ship every week.' : '为持续创作的人准备的轻量工具包。',
      buttonText: isEnglish ? 'Explore toolkit' : '查看工具包',
      targetUrl: '/store'
    })
  }
  await db.insert(adPlacements).values({
    slotKey: 'sidebar-ad',
    campaignId: affiliateCreated!.insertId,
    priority: 0
  })
}
