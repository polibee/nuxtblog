import { createError } from 'h3'
import { and, eq, gt } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import {
  membershipPlans,
  membershipPlanTranslations,
  postPurchases,
  subscriptions
} from '../../repositories/schema/membership'
import { adCampaigns } from '../../repositories/schema/advertising'
import { products, productPrices } from '../../repositories/schema/products'
import { listLocales } from '../../repositories/locale.repository'
import { orderItems, orders } from '../../repositories/schema/orders'

/* P15 membership + paid posts. Shadow products bridge memberships and
   single-post purchases onto the existing order/payment chain: each
   plan (or paid post) owns a published product with product_type
   'membership' | 'post_access'; checkout is the standard orders flow. */

const SHADOW_TYPES = ['membership', 'post_access', 'ad_campaign']

export function shadowProductAlias(kind: 'membership' | 'post_access' | 'ad_campaign', refId: number): string {
  return kind === 'membership' ? `plan-${refId}` : kind === 'ad_campaign' ? `ad-${refId}` : `post-${refId}`
}

export async function ensureShadowProduct(
  kind: 'membership' | 'post_access' | 'ad_campaign',
  refId: number,
  title: string,
  priceMinor: number,
  currency: string
): Promise<string> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const alias = shadowProductAlias(kind, refId)
  const db = getDb()
  const [existing] = await db.select().from(products).where(eq(products.alias, alias)).limit(1)
  if (existing) {
    // keep price in sync with the source (plan/post)
    await db.update(productPrices).set({ amountMinor: priceMinor, enabled: true })
      .where(and(eq(productPrices.productId, existing.id), eq(productPrices.currency, currency)))
    return alias
  }
  const locales = await listLocales()
  const defaultId = locales.find(l => l.isDefault)?.id ?? locales[0]?.id ?? 1
  const [row] = await db.insert(products).values({
    alias,
    productType: kind,
    deliveryStrategy: 'one_time_reveal',
    status: 'published',
    maxQuantityPerOrder: 1,
    primaryLocaleId: defaultId,
    createdBy: 1
  })
  const productId = row!.insertId
  await db.insert(productPrices).values({ productId, currency, amountMinor: priceMinor, enabled: true })
  void title
  return alias
}

/** deliver non-inventory order items: purchase grants / subscription renewal */
export async function fulfillShadowOrderItems(orderId: number): Promise<void> {
  const db = getDb()
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  for (const item of items) {
    if (item.productTypeSnapshot === 'ad_campaign') {
      /* P21 ad purchase: payment activates the campaign */
      const campaignId = Number(item.productAliasSnapshot.replace(/^ad-/, ''))
      if (!Number.isInteger(campaignId) || campaignId <= 0) continue
      const campaign = await db.select({ name: adCampaigns.name, slot: adCampaigns.materialSlotKey, budget: adCampaigns.budgetMinor }).from(adCampaigns).where(eq(adCampaigns.id, campaignId)).limit(1)
      const reviewEnabled = await import('../settings/settings.runtime.service').then(settings => settings.getSettingValue('ADVERTISING_REVIEW_ENABLED', true))
      await db.update(adCampaigns).set({
        status: 'pending_review',
        paidAmountMinor: item.totalAmountMinor,
        orderId,
        paidAt: new Date()
      }).where(eq(adCampaigns.id, campaignId))
      if (!reviewEnabled) {
        const { approveCampaign } = await import('../advertising/ad-purchase.service')
        await approveCampaign(campaignId)
      }
      const { appendOutbox } = await import('../notifications/engine')
      await appendOutbox(reviewEnabled ? 'advertising.purchase.pending_review' : 'advertising.purchase.approved', {
        module: 'advertising',
        severity: reviewEnabled ? 'warning' : 'info',
        entityType: 'ad_campaign',
        entityId: String(campaignId),
        data: {
          'campaign.id': campaignId,
          'campaign.name': campaign[0]?.name ?? `Campaign #${campaignId}`,
          'campaign.slot': campaign[0]?.slot ?? '',
          'campaign.budget': campaign[0]?.budget ?? item.totalAmountMinor,
          'order.id': orderId,
          'summary': reviewEnabled ? 'An advertising purchase requires review.' : 'An advertising purchase was automatically approved and placed.'
        }
      })
    } else if (item.productTypeSnapshot === 'post_access') {
      const postId = Number(item.productAliasSnapshot.replace(/^post-/, ''))
      if (!Number.isInteger(postId) || postId <= 0) continue
      const [order] = await db.select({ userId: orders.userId, email: orders.email })
        .from(orders).where(eq(orders.id, orderId)).limit(1)
      await db.insert(postPurchases).values({
        postId,
        orderId,
        userId: order?.userId ?? null,
        email: order?.email ?? '',
        purchasedAt: new Date()
      })
    } else if (item.productTypeSnapshot === 'membership') {
      const planId = Number(item.productAliasSnapshot.replace(/^plan-/, ''))
      if (!Number.isInteger(planId) || planId <= 0) continue
      const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1)
      if (!plan) continue
      const [order] = await db.select({ userId: orders.userId })
        .from(orders).where(eq(orders.id, orderId)).limit(1)
      const userId = Number(order?.userId ?? 0)
      if (!userId) continue
      const periodMs = plan.period === 'year' ? 365 * 86_400_000 : 30 * 86_400_000
      const [existing] = await db.select().from(subscriptions)
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.planId, planId))).limit(1)
      const base = existing && existing.currentPeriodEnd > new Date()
        ? existing.currentPeriodEnd.getTime()
        : Date.now()
      if (existing) {
        await db.update(subscriptions).set({
          status: 'active',
          currentPeriodEnd: new Date(base + periodMs)
        }).where(eq(subscriptions.id, existing.id))
      } else {
        await db.insert(subscriptions).values({
          userId,
          planId,
          status: 'active',
          currentPeriodEnd: new Date(base + periodMs)
        })
      }
    }
  }
}

/** viewer gate: does this identity have full access to a paid/members post? */
export async function hasPostAccess(postId: number, viewer: { id: number, email: string } | null): Promise<boolean> {
  if (!viewer) return false
  const db = getDb()
  const [purchased] = await db.select({ id: postPurchases.id })
    .from(postPurchases)
    .where(and(
      eq(postPurchases.postId, postId),
      viewer.id ? eq(postPurchases.userId, viewer.id) : eq(postPurchases.email, viewer.email)
    ))
    .limit(1)
  if (purchased) return true
  // any active membership subscription unlocks member/paid content
  if (viewer.id && await hasActiveMembership(viewer.id)) return true
  return false
}

/** Single source of truth for the membership projection used by public identity badges. */
export async function hasActiveMembership(userId: number, now = new Date()): Promise<boolean> {
  const [active] = await getDb().select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, 'active'),
      gt(subscriptions.currentPeriodEnd, now)
    ))
    .limit(1)
  return Boolean(active)
}

/** public plans listing (published, with default-locale name) */
export async function listPublishedPlans(): Promise<Array<{
  id: number
  alias: string
  productAlias: string
  name: string
  description: string | null
  priceMinor: number
  currency: string
  period: string
}>> {
  if (!isBlogDbReady()) return []
  const db = getDb()
  const plans = await db.select().from(membershipPlans).where(eq(membershipPlans.status, 'published'))
  const locales = await listLocales()
  const out: Array<{ id: number, alias: string, productAlias: string, name: string, description: string | null, priceMinor: number, currency: string, period: string }> = []
  for (const plan of plans) {
    const rows = await db.select()
      .from(membershipPlanTranslations)
      .where(eq(membershipPlanTranslations.entityId, plan.id))
    const byLocale = new Map<number, typeof rows[number]>()
    for (const r of rows) byLocale.set(r.localeId, r)
    const fallback = rows[0]
    const locale = byLocale.get(locales.find(l => l.isDefault)?.id ?? 0) ?? fallback
    if (!locale) continue
    await ensureShadowProduct('membership', plan.id, locale.name, plan.priceMinor, plan.currency)
    out.push({
      id: plan.id,
      alias: plan.alias,
      productAlias: shadowProductAlias('membership', plan.id),
      name: locale.name,
      description: locale.description,
      priceMinor: plan.priceMinor,
      currency: plan.currency,
      period: plan.period
    })
  }
  return out
}

/** admin: list all plans with primary-locale name */
export async function listPlansForAdmin(): Promise<Array<{
  id: number
  alias: string
  name: string
  priceMinor: number
  currency: string
  period: string
  status: string
}>> {
  const db = getDb()
  const plans = await db.select().from(membershipPlans)
  const out = []
  for (const plan of plans) {
    const [name] = await db.select({ name: membershipPlanTranslations.name })
      .from(membershipPlanTranslations)
      .where(eq(membershipPlanTranslations.entityId, plan.id))
      .limit(1)
    out.push({
      id: plan.id,
      alias: plan.alias,
      name: name?.name ?? plan.alias,
      priceMinor: plan.priceMinor,
      currency: plan.currency,
      period: plan.period,
      status: plan.status
    })
  }
  return out
}

export async function createPlan(body: {
  alias: string
  name: string
  priceMinor: number
  currency: string
  period?: string
  status?: string
}): Promise<number> {
  const db = getDb()
  const [row] = await db.insert(membershipPlans).values({
    alias: body.alias,
    priceMinor: body.priceMinor,
    currency: body.currency,
    period: body.period ?? 'month',
    status: body.status ?? 'published'
  })
  const planId = row!.insertId
  const locales = await listLocales()
  const defaultId = locales.find(l => l.isDefault)?.id ?? locales[0]?.id ?? 1
  await db.insert(membershipPlanTranslations).values({
    entityId: planId,
    localeId: defaultId,
    name: body.name
  })
  return planId
}

export async function deletePlan(id: number): Promise<void> {
  const db = getDb()
  await db.delete(membershipPlans).where(eq(membershipPlans.id, id))
}

export { SHADOW_TYPES }
