import { createError } from 'h3'
import { isBlogDbReady } from '../../repositories/db.server'
import {
  findEnabledCreativeById,
  findCreativeTranslation,
  incrementClicks,
  incrementImpressions
} from '../../repositories/advertising.repository'
import { getSessionUser } from '../../utils/auth'
import { decide } from './decision.service'
import { renderWith } from './provider-registry'

/* Advertising Service (impl doc §4): single entry point for the Nitro
   routes. Calls the Decision Service, renders via the Provider Registry,
   counts impressions fire-and-forget, records clicks. */

import type { AdPayload, Viewer } from './types'

export async function getViewer(event: Parameters<typeof getSessionUser>[0]): Promise<Viewer | null> {
  const user = await getSessionUser(event)
  return user ? { id: user.id, email: user.email } : null
}

export function parseLocales(rawLocale: string | undefined, fallbackLocaleId: number): number {
  void rawLocale
  return fallbackLocaleId
}

async function incrementImpressionsSafe(creativeId: number): Promise<void> {
  try {
    await incrementImpressions(creativeId)
  } catch {
    // stats must never break rendering
  }
}

async function renderDecision(
  slotKey: string,
  localeId: number,
  decision: { creativeId: number | null, reason: string }
): Promise<AdPayload> {
  if (!decision.creativeId) {
    return { kind: 'NO_AD', reason: decision.reason }
  }
  const creative = await findEnabledCreativeById(decision.creativeId)
  if (!creative) return { kind: 'NO_AD', reason: 'no_campaign' }
  const translation = await findCreativeTranslation(decision.creativeId, localeId)
    ?? await findCreativeTranslation(decision.creativeId, 1)
  if (!translation) return { kind: 'NO_AD', reason: 'no_translation' }
  const payload = renderWith(creative.provider, translation)
  void incrementImpressionsSafe(decision.creativeId)
  return payload
}

export async function resolveSlot(
  slotKey: string,
  path: string,
  localeId: number,
  viewer: Viewer | null
): Promise<AdPayload> {
  if (!slotKey) {
    throw createError({ statusCode: 400, statusMessage: 'slot is required' })
  }
  const decision = await decide({ slotKey, path, localeId, userId: viewer?.id ?? null })
  return renderDecision(slotKey, localeId, decision)
}

export async function resolveBatch(
  slotKeys: string[],
  path: string,
  localeId: number,
  viewer: Viewer | null
): Promise<Record<string, AdPayload>> {
  if (!isBlogDbReady()) {
    return Object.fromEntries(slotKeys.map(k => [k, { kind: 'NO_AD' as const, reason: 'db_unavailable' }]))
  }
  const results: Record<string, AdPayload> = {}
  for (const slotKey of slotKeys) {
    const decision = await decide({ slotKey, path, localeId, userId: viewer?.id ?? null })
    results[slotKey] = await renderDecision(slotKey, localeId, decision)
  }
  return results
}

export async function recordClick(creativeId: number, localeId: number): Promise<string | null> {
  if (!isBlogDbReady()) return null
  const creative = await findEnabledCreativeById(creativeId)
  if (!creative) return null
  const translation = await findCreativeTranslation(creativeId, localeId)
    ?? await findCreativeTranslation(creativeId, 1)
  const target = translation?.targetUrl?.trim() ?? ''
  if (!(target.startsWith('/') || /^https?:\/\//i.test(target))) return null
  try {
    await incrementClicks(creativeId)
  } catch {
    // stats only
  }
  return target
}
