import { asc, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { getDb, isBlogDbReady } from '../../repositories/db.server'
import { aiAssistantPresets } from '../../repositories/schema/ai'

/* P33 Assistant Presets (docs/AI组件优化.txt C3 §29-35/59-64): a preset
   is a work mode — instructions + default scope/depth + tool policy +
   suggested questions. Built-ins are seeded once and only duplicated,
   never edited in place (§34). Custom instructions are "custom
   instructions", never a system override (§48/11). */

export interface AssistantPreset {
  id: number
  name: string
  slug: string
  description: string
  icon: string
  type: 'builtin' | 'custom'
  instructions: string
  defaultScope: string
  defaultDepth: 'quick' | 'balanced' | 'deep'
  allowedToolGroups: string[] | null
  allowedScopes: string[] | null
  suggestedQuestions: string[]
  enabled: boolean
  sortOrder: number
  promptVersion: number
}

function rowToPreset(row: typeof aiAssistantPresets.$inferSelect): AssistantPreset {
  const parseList = (json: string | null): string[] | null => {
    if (!json) return null
    try {
      const parsed = JSON.parse(json)
      return Array.isArray(parsed) ? parsed.map(String) : null
    } catch {
      return null
    }
  }
  let questions: string[] = []
  try {
    const parsed = row.suggestedQuestionsJson ? JSON.parse(row.suggestedQuestionsJson) as unknown : []
    questions = Array.isArray(parsed) ? parsed.map(String).slice(0, 8) : []
  } catch { /* optional */ }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    type: row.type === 'builtin' ? 'builtin' : 'custom',
    instructions: row.instructions,
    defaultScope: row.defaultScope,
    defaultDepth: (['quick', 'balanced', 'deep'].includes(row.defaultDepth) ? row.defaultDepth : 'balanced') as AssistantPreset['defaultDepth'],
    allowedToolGroups: parseList(row.allowedToolGroupsJson),
    allowedScopes: parseList(row.allowedScopesJson),
    suggestedQuestions: questions,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    promptVersion: row.promptVersion
  }
}

/* §59: exactly the recommended first-version set. Suggestions are
   locale-neutral English placeholders — the UI shows its own scope
   suggestions when the preset has none. */
const BUILTIN_PRESETS = [
  {
    name: 'General Assistant',
    slug: 'general-assistant',
    description: 'Answer any question about the site; only call tools when data is needed.',
    instructions: 'Prioritize answering the user directly. Call tools only when real site data is required — do not scan the whole site to look busy. Offer one or two concrete follow-up actions.',
    defaultScope: 'site',
    defaultDepth: 'balanced',
    allowedToolGroups: null,
    allowedScopes: null,
    suggested: ['What should I optimize across the whole site?', 'Summarize the state of my content.'],
    sortOrder: 1
  },
  {
    name: 'Site Auditor',
    slug: 'site-auditor',
    description: 'Whole-site review: content, SEO, profile, store and comments.',
    instructions: 'Start from the site overview, then drill into the weakest areas. Produce a prioritized list: issue, impact, suggested action. Cite the posts/pages you reference.',
    defaultScope: 'site',
    defaultDepth: 'balanced',
    allowedToolGroups: null,
    allowedScopes: null,
    suggested: ['What are the biggest issues on my site?', 'Which pages should I optimize first?'],
    sortOrder: 2
  },
  {
    name: 'SEO Auditor',
    slug: 'seo-auditor',
    description: 'Technical and semantic SEO review with priorities.',
    instructions: 'For each finding report: problem, impact, priority, suggested fix. Check missing/short metadata first, then semantic quality. Always list affected titles as sources.',
    defaultScope: 'seo',
    defaultDepth: 'balanced',
    allowedToolGroups: ['seo', 'content'],
    allowedScopes: ['seo', 'posts', 'pages', 'profile', 'store'],
    suggested: ['Which posts are missing metadata?', 'Find internal linking opportunities.', 'Prioritize my SEO issues.'],
    sortOrder: 3
  },
  {
    name: 'Content Reviewer',
    slug: 'content-reviewer',
    description: 'Clarity, structure, duplication and content gaps.',
    instructions: 'Review the selected content for clarity, structure and duplication. Point out content gaps and internal linking opportunities. Be specific: quote the sentence you would change.',
    defaultScope: 'posts',
    defaultDepth: 'balanced',
    allowedToolGroups: ['content'],
    allowedScopes: ['posts', 'pages'],
    suggested: ['Which posts are too long?', 'Where does my content duplicate itself?'],
    sortOrder: 4
  },
  {
    name: 'Internal Link Finder',
    slug: 'internal-link-finder',
    description: 'Find useful internal linking opportunities between posts.',
    instructions: 'Look at titles, excerpts, keywords and headings to propose post pairs that should link to each other. For each pair explain the anchor topic. List at most 10 pairs, best first.',
    defaultScope: 'posts',
    defaultDepth: 'balanced',
    allowedToolGroups: ['content', 'seo'],
    allowedScopes: ['posts', 'seo'],
    suggested: ['Find opportunities across all posts.', 'Which posts are orphans?'],
    sortOrder: 5
  },
  {
    name: 'Profile Reviewer',
    slug: 'profile-reviewer',
    description: 'Review the /profile page: experience, projects, skills, focus.',
    instructions: 'Review the profile for repetition, weak wording and outdated items. Check whether projects and the current focus tell one coherent story. Suggest concrete rewrites.',
    defaultScope: 'profile',
    defaultDepth: 'balanced',
    allowedToolGroups: ['profile', 'content'],
    allowedScopes: ['profile', 'seo'],
    suggested: ['Which parts of my profile read as repetitive?', 'Should my current focus be updated?'],
    sortOrder: 6
  },
  {
    name: 'Store Reviewer',
    slug: 'store-reviewer',
    description: 'Product copy and catalog review.',
    instructions: 'Review product descriptions for completeness and persuasiveness. Flag products with missing or too-short copy. Suggest improved descriptions where useful.',
    defaultScope: 'store',
    defaultDepth: 'balanced',
    allowedToolGroups: ['store', 'content'],
    allowedScopes: ['store'],
    suggested: ['Which products are missing information?', 'Review my product descriptions.'],
    sortOrder: 7
  },
  {
    name: 'Comment Analyst',
    slug: 'comment-analyst',
    description: 'Insights from approved comments and moderation load.',
    instructions: 'Summarize what visitors ask and praise. Cluster recurring questions that deserve a post or FAQ. Report moderation backlog separately.',
    defaultScope: 'comments',
    defaultDepth: 'quick',
    allowedToolGroups: ['comments', 'site'],
    allowedScopes: ['comments'],
    suggested: ['What are visitors asking about?', 'How many comments are pending?'],
    sortOrder: 8
  }
] as const

let seeded = false

export async function ensurePresetsSeeded(): Promise<void> {
  if (seeded || !isBlogDbReady()) return
  const [row] = await getDb().select({ id: aiAssistantPresets.id }).from(aiAssistantPresets).limit(1)
  if (!row) {
    for (const preset of BUILTIN_PRESETS) {
      await getDb().insert(aiAssistantPresets).values({
        name: preset.name,
        slug: preset.slug,
        description: preset.description,
        type: 'builtin',
        instructions: preset.instructions,
        defaultScope: preset.defaultScope,
        defaultDepth: preset.defaultDepth,
        allowedToolGroupsJson: preset.allowedToolGroups ? JSON.stringify(preset.allowedToolGroups) : null,
        allowedScopesJson: preset.allowedScopes ? JSON.stringify(preset.allowedScopes) : null,
        suggestedQuestionsJson: JSON.stringify(preset.suggested),
        sortOrder: preset.sortOrder
      }).onDuplicateKeyUpdate({ set: { name: preset.name } })
    }
  }
  seeded = true
}

export async function listPresets(includeDisabled = false): Promise<AssistantPreset[]> {
  if (!isBlogDbReady()) return []
  await ensurePresetsSeeded()
  const rows = await getDb().select().from(aiAssistantPresets).orderBy(asc(aiAssistantPresets.sortOrder), asc(aiAssistantPresets.id))
  return rows.map(rowToPreset).filter(p => includeDisabled || p.enabled)
}

export async function getPreset(id: number): Promise<AssistantPreset | null> {
  if (!isBlogDbReady()) return null
  await ensurePresetsSeeded()
  const [row] = await getDb().select().from(aiAssistantPresets).where(eq(aiAssistantPresets.id, id)).limit(1)
  return row ? rowToPreset(row) : null
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '')
  return base || `preset-${Date.now()}`
}

export async function createPreset(input: {
  name: string
  description?: string
  instructions: string
  defaultScope?: string
  defaultDepth?: string
  allowedToolGroups?: string[] | null
  suggestedQuestions?: string[]
  createdBy?: number | null
}): Promise<AssistantPreset> {
  if (!input.name.trim()) throw createError({ statusCode: 422, statusMessage: 'name is required' })
  if (input.instructions.length > 8000) throw createError({ statusCode: 422, statusMessage: 'instructions too long (max 8000 chars)' })
  let slug = slugify(input.name)
  const existing = await listPresets(true)
  if (existing.some(p => p.slug === slug)) slug = `${slug}-${Date.now().toString(36)}`
  const [row] = await getDb().insert(aiAssistantPresets).values({
    name: input.name.trim().slice(0, 80),
    slug,
    description: (input.description ?? '').slice(0, 200),
    type: 'custom',
    instructions: input.instructions,
    defaultScope: input.defaultScope ?? 'site',
    defaultDepth: ['quick', 'balanced', 'deep'].includes(input.defaultDepth ?? '') ? input.defaultDepth! : 'balanced',
    allowedToolGroupsJson: input.allowedToolGroups ? JSON.stringify(input.allowedToolGroups) : null,
    suggestedQuestionsJson: JSON.stringify((input.suggestedQuestions ?? []).slice(0, 8)),
    createdBy: input.createdBy ?? null,
    sortOrder: 100
  })
  return (await getPreset(row!.insertId))!
}

export async function updatePreset(id: number, input: {
  name?: string
  description?: string
  instructions?: string
  defaultScope?: string
  defaultDepth?: string
  enabled?: boolean
  suggestedQuestions?: string[]
}): Promise<AssistantPreset> {
  const preset = await getPreset(id)
  if (!preset) throw createError({ statusCode: 404, statusMessage: 'Preset not found' })
  /* §34: built-ins are not editable in place */
  if (preset.type === 'builtin') {
    throw createError({ statusCode: 403, statusMessage: 'Built-in presets cannot be edited — duplicate it first' })
  }
  const patch: Partial<typeof aiAssistantPresets.$inferInsert> = {}
  if (input.name !== undefined) patch.name = input.name.trim().slice(0, 80)
  if (input.description !== undefined) patch.description = input.description.slice(0, 200)
  if (input.instructions !== undefined) {
    if (input.instructions.length > 8000) throw createError({ statusCode: 422, statusMessage: 'instructions too long (max 8000 chars)' })
    /* §33: instructions changed → prompt version bump */
    if (input.instructions !== preset.instructions) patch.promptVersion = preset.promptVersion + 1
    patch.instructions = input.instructions
  }
  if (input.defaultScope !== undefined) patch.defaultScope = input.defaultScope
  if (input.defaultDepth !== undefined && ['quick', 'balanced', 'deep'].includes(input.defaultDepth)) patch.defaultDepth = input.defaultDepth
  if (input.enabled !== undefined) patch.enabled = input.enabled
  if (input.suggestedQuestions !== undefined) patch.suggestedQuestionsJson = JSON.stringify(input.suggestedQuestions.slice(0, 8))
  await getDb().update(aiAssistantPresets).set(patch).where(eq(aiAssistantPresets.id, id))
  return (await getPreset(id))!
}

export async function duplicatePreset(id: number, createdBy: number | null): Promise<AssistantPreset> {
  const preset = await getPreset(id)
  if (!preset) throw createError({ statusCode: 404, statusMessage: 'Preset not found' })
  return createPreset({
    name: `${preset.name} - Custom`,
    description: preset.description,
    instructions: preset.instructions,
    defaultScope: preset.defaultScope,
    defaultDepth: preset.defaultDepth,
    allowedToolGroups: preset.allowedToolGroups,
    suggestedQuestions: preset.suggestedQuestions,
    createdBy
  })
}

export async function deletePreset(id: number): Promise<void> {
  const preset = await getPreset(id)
  if (!preset) return
  if (preset.type === 'builtin') {
    throw createError({ statusCode: 403, statusMessage: 'Built-in presets cannot be deleted' })
  }
  await getDb().delete(aiAssistantPresets).where(eq(aiAssistantPresets.id, id))
}
