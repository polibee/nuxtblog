import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { getDb, isBlogDbReady } from '../../../repositories/db.server'
import { aiArtifacts } from '../../../repositories/schema/ai'
import { singleFlight } from './single-flight'

/* P31 AI Artifact Store (缓存优化 §35/36): persistent LLM analysis
   artifacts keyed on source fingerprint + prompt version + model.
   Used by digests today; Page AI / Site Reports will reuse it. */

export interface ArtifactKey {
  entityType: string
  entityId: string
  artifactType: string
  fingerprint: string
  model?: string
  promptId?: string
  promptVersion?: number
}

export async function getArtifact<T>(key: ArtifactKey): Promise<T | null> {
  if (!isBlogDbReady()) return null
  const rows = await getDb()
    .select({ payloadJson: aiArtifacts.payloadJson })
    .from(aiArtifacts)
    .where(and(
      eq(aiArtifacts.entityType, key.entityType),
      eq(aiArtifacts.entityId, key.entityId),
      eq(aiArtifacts.artifactType, key.artifactType),
      eq(aiArtifacts.sourceFingerprint, key.fingerprint),
      eq(aiArtifacts.model, key.model ?? ''),
      eq(aiArtifacts.promptVersion, key.promptVersion ?? 1),
      or(isNull(aiArtifacts.expiresAt), gt(aiArtifacts.expiresAt, new Date()))
    ))
    .limit(1)
  if (!rows[0]) return null
  try {
    return JSON.parse(rows[0].payloadJson) as T
  } catch {
    return null
  }
}

export async function saveArtifact(key: ArtifactKey, payload: unknown, options?: {
  inputTokens?: number | null
  outputTokens?: number | null
  expiresAt?: Date | null
}): Promise<void> {
  if (!isBlogDbReady()) return
  try {
    await getDb()
      .insert(aiArtifacts)
      .values({
        entityType: key.entityType,
        entityId: key.entityId,
        artifactType: key.artifactType,
        sourceFingerprint: key.fingerprint,
        model: key.model ?? '',
        promptId: key.promptId ?? '',
        promptVersion: key.promptVersion ?? 1,
        payloadJson: JSON.stringify(payload),
        inputTokens: options?.inputTokens ?? null,
        outputTokens: options?.outputTokens ?? null,
        expiresAt: options?.expiresAt ?? null
      })
      .onDuplicateKeyUpdate({
        set: {
          payloadJson: JSON.stringify(payload),
          inputTokens: options?.inputTokens ?? null,
          outputTokens: options?.outputTokens ?? null,
          createdAt: new Date(),
          expiresAt: options?.expiresAt ?? null
        }
      })
  } catch (e) {
    console.error('[ai-cache] artifact save failed:', (e as Error).message)
  }
}

/** get-or-compute with single-flight (§48/53) */
export async function withArtifact<T>(key: ArtifactKey, compute: () => Promise<{
  payload: T
  inputTokens?: number | null
  outputTokens?: number | null
  expiresAt?: Date | null
}>): Promise<{ payload: T, hit: boolean }> {
  const cached = await getArtifact<T>(key)
  if (cached !== null) return { payload: cached, hit: true }
  const { payload, ...meta } = await singleFlight(
    `${key.entityType}:${key.entityId}:${key.artifactType}:${key.fingerprint}:${key.model ?? ''}:${key.promptVersion ?? 1}`,
    compute
  )
  await saveArtifact(key, payload, meta)
  return { payload, hit: false }
}
