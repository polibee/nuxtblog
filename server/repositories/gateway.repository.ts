import { asc, eq } from 'drizzle-orm'
import { getDb } from './db.server'
import { paymentGateways } from './schema/payments'
import { decryptSecret, encryptSecret } from '../utils/encryption'

/* payment_gateways repository (commerce doc §8.3).
   Config is stored AES-256-GCM encrypted; decryption only for drivers,
   admin API returns masked values. */

export interface GatewayRow {
  id: number
  key: string
  providerKey: string
  displayName: string
  enabled: boolean
  mode: string
  sortOrder: number
  enabledCurrencies: string | null
  config: Record<string, string> | null
}

function toRow(raw: typeof paymentGateways.$inferSelect): GatewayRow {
  let config: Record<string, string> | null = null
  if (raw.configCiphertext && raw.configNonce && raw.configAuthTag) {
    config = JSON.parse(decryptSecret({
      ciphertext: raw.configCiphertext,
      nonce: raw.configNonce,
      authTag: raw.configAuthTag
    })) as Record<string, string>
  }
  return {
    id: raw.id,
    key: raw.key,
    providerKey: raw.providerKey,
    displayName: raw.displayName,
    enabled: raw.enabled,
    mode: raw.mode,
    sortOrder: raw.sortOrder,
    enabledCurrencies: raw.enabledCurrencies,
    config
  }
}

export async function listGateways(enabledOnly = false): Promise<GatewayRow[]> {
  const rows = await getDb().select().from(paymentGateways).orderBy(asc(paymentGateways.sortOrder), asc(paymentGateways.id))
  const mapped = rows.map(toRow)
  return enabledOnly ? mapped.filter(g => g.enabled) : mapped
}

export async function findGatewayByKey(key: string): Promise<GatewayRow | undefined> {
  const rows = await getDb().select().from(paymentGateways).where(eq(paymentGateways.key, key)).limit(1)
  return rows[0] ? toRow(rows[0]) : undefined
}

export async function findGatewayById(id: number): Promise<GatewayRow | undefined> {
  const rows = await getDb().select().from(paymentGateways).where(eq(paymentGateways.id, id)).limit(1)
  return rows[0] ? toRow(rows[0]) : undefined
}

export async function insertGateway(input: {
  key: string
  providerKey: string
  displayName: string
  enabled: boolean
  mode: string
  sortOrder: number
  enabledCurrencies: string | null
  config: Record<string, string> | null
}): Promise<number> {
  const encrypted = input.config ? encryptSecret(JSON.stringify(input.config)) : null
  const [row] = await getDb().insert(paymentGateways).values({
    key: input.key,
    providerKey: input.providerKey,
    displayName: input.displayName,
    enabled: input.enabled,
    mode: input.mode,
    sortOrder: input.sortOrder,
    enabledCurrencies: input.enabledCurrencies,
    configCiphertext: encrypted?.ciphertext ?? null,
    configNonce: encrypted?.nonce ?? null,
    configAuthTag: encrypted?.authTag ?? null
  })
  if (!row) throw new Error('gateway insert returned no id')
  return row.insertId
}

export async function updateGateway(id: number, patch: {
  displayName?: string
  enabled?: boolean
  mode?: string
  sortOrder?: number
  enabledCurrencies?: string | null
  config?: Record<string, string> | null
}): Promise<void> {
  const values: Partial<typeof paymentGateways.$inferInsert> = {}
  if (patch.displayName !== undefined) values.displayName = patch.displayName
  if (patch.enabled !== undefined) values.enabled = patch.enabled
  if (patch.mode !== undefined) values.mode = patch.mode
  if (patch.sortOrder !== undefined) values.sortOrder = patch.sortOrder
  if (patch.enabledCurrencies !== undefined) values.enabledCurrencies = patch.enabledCurrencies
  if (patch.config !== undefined) {
    const encrypted = patch.config ? encryptSecret(JSON.stringify(patch.config)) : null
    values.configCiphertext = encrypted?.ciphertext ?? null
    values.configNonce = encrypted?.nonce ?? null
    values.configAuthTag = encrypted?.authTag ?? null
  }
  if (Object.keys(values).length > 0) {
    await getDb().update(paymentGateways).set(values).where(eq(paymentGateways.id, id))
  }
}

export async function deleteGateway(id: number): Promise<void> {
  await getDb().delete(paymentGateways).where(eq(paymentGateways.id, id))
}
