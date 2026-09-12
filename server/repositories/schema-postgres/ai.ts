import {
  text,
  bigint,
  boolean,
  timestamp,
  index,
  integer,
  pgTable,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

/* P28 AI integration: provider registry (API keys AES-256-GCM encrypted
   with the commerce key) + per-request usage log. No content storage —
   prompts/responses are never persisted (AI doc §38/111). */

export const aiProviders = pgTable(
  'ai_providers',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    /* openai | openai_compatible | anthropic */
    providerType: varchar('provider_type', { length: 30 }).notNull().default('openai_compatible'),
    baseUrl: varchar('base_url', { length: 300 }).notNull(),
    /* AES-256-GCM JSON { ciphertext, nonce, authTag } */
    apiKeyEncrypted: text('api_key_encrypted'),
    apiKeyHint: varchar('api_key_hint', { length: 60 }).notNull().default(''),
    defaultModel: varchar('default_model', { length: 100 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    index('ai_providers_enabled_idx').on(table.enabled)
  ]
)

export const aiRequests = pgTable(
  'ai_requests',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    feature: varchar('feature', { length: 50 }).notNull(),
    providerId: bigint('provider_id', { mode: 'number' }),
    model: varchar('model', { length: 100 }).notNull().default(''),
    status: varchar('status', { length: 20 }).notNull().default('ok'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    latencyMs: integer('latency_ms'),
    errorCode: varchar('error_code', { length: 80 }),
    userId: bigint('user_id', { mode: 'number' }),
    /* P31 optimization layer (§45): cache accounting per request */
    cacheStatus: varchar('cache_status', { length: 40 }).notNull().default('MISS'),
    cachedInputTokens: integer('cached_input_tokens'),
    savedTokens: integer('saved_tokens'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  table => [
    index('ai_requests_feature_idx').on(table.feature, table.createdAt)
  ]
)

/* P31 AI Optimization Layer (缓存优化 §35/36): persistent analysis
   artifacts — digest/analysis/report keyed on source fingerprint +
   prompt version + model. */
export const aiArtifacts = pgTable(
  'ai_artifacts',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    /* numeric id or textual key ('site', 'editor:selection') */
    entityId: varchar('entity_id', { length: 120 }).notNull().default(''),
    artifactType: varchar('artifact_type', { length: 40 }).notNull(),
    sourceFingerprint: varchar('source_fingerprint', { length: 64 }).notNull(),
    provider: varchar('provider', { length: 60 }).notNull().default(''),
    model: varchar('model', { length: 100 }).notNull().default(''),
    promptId: varchar('prompt_id', { length: 60 }).notNull().default(''),
    promptVersion: integer('prompt_version').notNull().default(1),
    payloadJson: text('payload_json').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' })
  },
  table => [
    uniqueIndex('ai_artifacts_lookup_idx').on(
      table.entityType,
      table.entityId,
      table.artifactType,
      table.sourceFingerprint,
      table.model,
      table.promptVersion
    ),
    index('ai_artifacts_entity_idx').on(table.entityType, table.entityId, table.createdAt)
  ]
)

/* P31 Tool Result Cache (§8/37/52): key = hash(tool + normalized args +
   domain versions); version-based invalidation via ai_domain_versions,
   plus a TTL safety net. */
export const aiToolCache = pgTable(
  'ai_tool_cache',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    cacheKey: varchar('cache_key', { length: 64 }).notNull(),
    toolName: varchar('tool_name', { length: 80 }).notNull(),
    scope: varchar('scope', { length: 60 }).notNull().default(''),
    dataVersion: varchar('data_version', { length: 200 }).notNull().default(''),
    payloadJson: text('payload_json').notNull(),
    payloadChars: integer('payload_chars').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' })
  },
  table => [
    uniqueIndex('ai_tool_cache_key_idx').on(table.cacheKey),
    index('ai_tool_cache_expires_idx').on(table.expiresAt)
  ]
)

/* P31 Domain Version Counters (§10/31/32): event-driven invalidation —
   content writes bump the domains they touch. */
export const aiDomainVersions = pgTable(
  'ai_domain_versions',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    domain: varchar('domain', { length: 40 }).notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [uniqueIndex('ai_domain_versions_domain_idx').on(table.domain)]
)

/* P33 Assistant Presets (组件优化 §31): a preset is a full AI work mode —
   instructions + default scope/depth + tool policy + suggested
   questions. Built-ins are seeded and never modified in place (§34). */
export const aiAssistantPresets = pgTable(
  'ai_assistant_presets',
  {
    id: bigint('id', { mode: 'number' }).notNull().generatedByDefaultAsIdentity().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    description: varchar('description', { length: 200 }).notNull().default(''),
    icon: varchar('icon', { length: 40 }).notNull().default('sparkles'),
    /* builtin | custom */
    type: varchar('type', { length: 20 }).notNull().default('custom'),
    instructions: text('instructions').notNull().default(''),
    defaultScope: varchar('default_scope', { length: 30 }).notNull().default('site'),
    defaultDepth: varchar('default_depth', { length: 20 }).notNull().default('balanced'),
    /* null = automatic (all read tools); else namespace prefixes */
    allowedToolGroupsJson: text('allowed_tool_groups_json'),
    allowedScopesJson: text('allowed_scopes_json'),
    suggestedQuestionsJson: text('suggested_questions_json'),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    /* §33: bumped on instructions change — feeds future cache keys */
    promptVersion: integer('prompt_version').notNull().default(1),
    createdBy: bigint('created_by', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date())
  },
  table => [
    uniqueIndex('ai_assistant_presets_slug_idx').on(table.slug),
    index('ai_assistant_presets_enabled_idx').on(table.enabled, table.sortOrder)
  ]
)
