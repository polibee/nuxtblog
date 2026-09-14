import { createError } from 'h3'
import { and, desc, eq } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import { adCampaigns, adCreativeTranslations, adCreatives, adPlacements, adSlots } from '../../repositories/schema/advertising'
import { orderItems, orders } from '../../repositories/schema/orders'
import { financialTransactions } from '../../repositories/schema/payments'
import { listPaymentAttemptsForOrder } from '../../repositories/payment.repository'
import { getSettingValue, listSettings, updateSettingValue } from '../settings/settings.service'
import { listLocales } from '../../repositories/locale.repository'
import { createOrder } from '../store/order.service'
import { findOrderByNumber } from '../../repositories/order.repository'
import { ensureShadowProduct } from '../membership/membership.service'

/* P21 ad purchase: a campaign is bought through the standard order /
   payment chain. The campaign owns the ad-{id} shadow product; once the
   gateway confirms payment, the fulfillment hook activates the campaign
   and stamps paid_amount/order_id/paid_at (membership.service). */

export async function purchaseCampaign(
  campaignId: number,
  input: { budgetMinor?: number, currency?: string },
  buyer: { id: number, email: string } | null
): Promise<{ orderNumber: string }> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const db = getDb()
  const [campaign] = await db.select().from(adCampaigns).where(eq(adCampaigns.id, campaignId)).limit(1)
  if (!campaign) {
    throw createError({ statusCode: 404, statusMessage: `Campaign #${campaignId} not found` })
  }
  if (!buyer) {
    throw createError({ statusCode: 401, statusMessage: 'Login required to purchase' })
  }

  const currency = (input.currency ?? campaign.currency ?? 'USD').toUpperCase()
  const budgetMinor = Math.max(Number(input.budgetMinor ?? campaign.budgetMinor) || 0, 0)
  if (budgetMinor <= 0) {
    throw createError({ statusCode: 422, statusMessage: 'Budget must be greater than zero' })
  }
  await db.update(adCampaigns).set({ budgetMinor, currency }).where(eq(adCampaigns.id, campaignId))

  const alias = await ensureShadowProduct('ad_campaign', campaign.id, campaign.name, budgetMinor, currency)
  const created = await createOrder({ productAlias: alias, quantity: 1, currency }, buyer)
  const order = await findOrderByNumber(created.orderNumber)
  if (order) await db.update(adCampaigns).set({ orderId: order.id }).where(eq(adCampaigns.id, campaign.id))
  return { orderNumber: created.orderNumber }
}

export interface CampaignPaymentRecord {
  orderId: number
  orderNumber: string
  status: string
  paymentStatus: string
  totalAmountMinor: number
  currency: string
  createdAt: Date
  paidAt: Date | null
  attempts: Array<{ id: number, gatewayKey: string, status: string, amountMinor: number, currency: string }>
  transactions: Array<{ id: number, transactionNumber: string, type: string, status: string, amountMinor: number, currency: string, gatewayKey: string | null, occurredAt: Date }>
}

export async function campaignPayments(campaignId: number): Promise<CampaignPaymentRecord[]> {
  if (!isBlogDbReady()) return []
  const db = getDb()
  const [campaign] = await db.select({ id: adCampaigns.id }).from(adCampaigns).where(eq(adCampaigns.id, campaignId)).limit(1)
  if (!campaign) {
    throw createError({ statusCode: 404, statusMessage: `Campaign #${campaignId} not found` })
  }
  const alias = `ad-${campaignId}`
  const rows = await db
    .selectDistinct({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalAmountMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.productAliasSnapshot, alias))
    .orderBy(desc(orders.id))
    .limit(50)

  const result: CampaignPaymentRecord[] = []
  for (const row of rows) {
    const [attempts, transactions] = await Promise.all([
      listPaymentAttemptsForOrder(row.orderId),
      db.select({
        id: financialTransactions.id,
        transactionNumber: financialTransactions.transactionNumber,
        type: financialTransactions.type,
        status: financialTransactions.status,
        amountMinor: financialTransactions.amountMinor,
        currency: financialTransactions.currency,
        gatewayKey: financialTransactions.gatewayKey,
        occurredAt: financialTransactions.occurredAt
      }).from(financialTransactions).where(eq(financialTransactions.orderId, row.orderId))
    ])
    result.push({
      ...row,
      attempts: attempts.map(a => ({
        id: a.id,
        gatewayKey: a.gatewayKey,
        status: a.status,
        amountMinor: a.amountMinor,
        currency: a.currency
      })),
      transactions
    })
  }
  return result
}

/* ---------------- P22 self-serve application + review ---------------- */

const URL_PATTERN = /^https?:\/\//i

export interface AdApplyInput {
  materialTitle: string
  materialDescription?: string
  materialImageMediaId: number
  materialUrl: string
  materialSlotKey: string
  contactEmail: string
  budgetMinor: number
  billingUnit?: 'day' | 'month'
  billingUnits?: number
}

/** public self-serve application: create a draft campaign with the
    submitted materials, then an order for the budget (guest checkout
    with the contact email). Payment moves it to pending_review. */
export async function applyForAd(input: AdApplyInput): Promise<{ campaignId: number, orderNumber: string }> {
  if (!isBlogDbReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
  const title = String(input.materialTitle ?? '').trim()
  const description = String(input.materialDescription ?? '').trim().slice(0, 500)
  const targetUrl = String(input.materialUrl ?? '').trim()
  const slotKey = String(input.materialSlotKey ?? '').trim()
  const email = String(input.contactEmail ?? '').trim()
  const budgetMinor = Math.floor(Number(input.budgetMinor) || 0)
  const billingUnit = input.billingUnit === 'month' ? 'month' : 'day'
  const billingUnits = Math.min(365, Math.max(1, Math.floor(Number(input.billingUnits) || 1)))
  const startAt = new Date()
  const endAt = new Date(startAt.getTime() + billingUnits * (billingUnit === 'month' ? 30 : 1) * 24 * 60 * 60 * 1000)
  const imageMediaId = Number(input.materialImageMediaId) || 0

  if (!title || title.length > 200) throw createError({ statusCode: 422, statusMessage: 'Material title is required (max 200 chars)' })
  if (!URL_PATTERN.test(targetUrl)) throw createError({ statusCode: 422, statusMessage: 'Target URL must be an http(s) URL' })
  if (!email.includes('@')) throw createError({ statusCode: 422, statusMessage: 'A valid contact email is required' })
  if (budgetMinor <= 0) throw createError({ statusCode: 422, statusMessage: 'Budget must be greater than zero' })
  if (!imageMediaId) throw createError({ statusCode: 422, statusMessage: 'A banner image is required' })

  const db = getDb()
  const [slot] = await db.select({ key: adSlots.key, priceMinor: adSlots.priceMinor }).from(adSlots)
    .where(and(eq(adSlots.key, slotKey), eq(adSlots.enabled, true))).limit(1)
  if (!slot) throw createError({ statusCode: 422, statusMessage: 'Unknown ad slot' })
  const minimumBudget = Math.max(0, Number(slot.priceMinor ?? 0)) * billingUnits
  if (minimumBudget > 0 && budgetMinor < minimumBudget) {
    throw createError({ statusCode: 422, statusMessage: `Budget must be at least ${minimumBudget} minor units for this slot and period` })
  }

  const [result] = await db.insert(adCampaigns).values({
    name: title,
    status: 'draft',
    startAt,
    endAt,
    budgetMinor,
    billingUnit,
    billingUnits,
    unitPriceMinor: Number(slot.priceMinor ?? 0),
    currency: 'USD',
    materialTitle: title,
    materialDescription: description || null,
    materialImageMediaId: imageMediaId,
    materialUrl: targetUrl,
    materialSlotKey: slot.key,
    contactEmail: email
  })
  const campaignId = result!.insertId

  const alias = await ensureShadowProduct('ad_campaign', campaignId, title, budgetMinor, 'USD')
  const created = await createOrder({ productAlias: alias, quantity: 1, currency: 'USD', email }, null)
  const order = await findOrderByNumber(created.orderNumber)
  if (order) await db.update(adCampaigns).set({ orderId: order.id }).where(eq(adCampaigns.id, campaignId))
  return { campaignId, orderNumber: created.orderNumber }
}

/** admin approval: activate + auto-build creative/translation/placement
    from the submitted materials */
export async function approveCampaign(campaignId: number): Promise<void> {
  const db = getDb()
  const [campaign] = await db.select().from(adCampaigns).where(eq(adCampaigns.id, campaignId)).limit(1)
  if (!campaign) throw createError({ statusCode: 404, statusMessage: `Campaign #${campaignId} not found` })
  if (campaign.status !== 'pending_review') {
    throw createError({ statusCode: 422, statusMessage: `Campaign status is "${campaign.status}", not pending_review` })
  }
  await db.update(adCampaigns).set({ status: 'active', reviewNote: null }).where(eq(adCampaigns.id, campaignId))

  const existing = await db.select({ id: adCreatives.id }).from(adCreatives).where(eq(adCreatives.campaignId, campaignId)).limit(1)
  if (existing.length > 0) return

  const locales = await listLocales()
  const localeId = locales.find(l => l.isDefault)?.id ?? locales[0]?.id ?? 1
  const [creative] = await db.insert(adCreatives).values({
    campaignId,
    provider: 'image',
    weight: 1,
    enabled: true
  })
  const creativeId = creative!.insertId
  await db.insert(adCreativeTranslations).values({
    creativeId,
    localeId,
    title: campaign.materialTitle ?? campaign.name,
    content: campaign.materialDescription ?? null,
    buttonText: 'Learn more',
    imageId: campaign.materialImageMediaId ?? null,
    targetUrl: campaign.materialUrl ?? null,
    altText: campaign.materialTitle ?? ''
  })
  if (campaign.materialSlotKey) {
    await db.insert(adPlacements).values({
      slotKey: campaign.materialSlotKey,
      campaignId,
      priority: 10,
      enabled: true
    })
  }
}

export async function rejectCampaign(campaignId: number, note: string): Promise<void> {
  const db = getDb()
  const [campaign] = await db.select().from(adCampaigns).where(eq(adCampaigns.id, campaignId)).limit(1)
  if (!campaign) throw createError({ statusCode: 404, statusMessage: `Campaign #${campaignId} not found` })
  if (campaign.status !== 'pending_review') {
    throw createError({ statusCode: 422, statusMessage: `Campaign status is "${campaign.status}", not pending_review` })
  }
  await db.update(adCampaigns).set({ status: 'rejected', reviewNote: note.slice(0, 500) }).where(eq(adCampaigns.id, campaignId))
}

export async function getPurchaseEnabled(): Promise<boolean> {
  return String(await getSettingValue('ADVERTISING_PURCHASE_ENABLED', 'true')) !== 'false'
}

export async function setPurchaseEnabled(enabled: boolean): Promise<void> {
  const items = await listSettings()
  const item = items.find(i => i.key === 'ADVERTISING_PURCHASE_ENABLED')
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Setting not found' })
  await updateSettingValue(item.id, enabled)
}

export async function getReviewEnabled(): Promise<boolean> {
  return String(await getSettingValue('ADVERTISING_REVIEW_ENABLED', 'true')) !== 'false'
}

export async function setReviewEnabled(enabled: boolean): Promise<void> {
  const items = await listSettings()
  const item = items.find(i => i.key === 'ADVERTISING_REVIEW_ENABLED')
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Setting not found' })
  await updateSettingValue(item.id, enabled)
}
