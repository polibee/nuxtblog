/* P31 Token Budget Manager (缓存优化 §22/23): estimate context size and
   shrink it by priority (P3 first) instead of blind truncation. */

export type ContextPriority = 0 | 1 | 2 | 3

export interface BudgetedItem {
  priority: ContextPriority
  text: string
}

/* rough token estimate: CJK chars ≈ 1 token, other scripts ≈ 4 chars/token */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x2e80) cjk++
  }
  const other = text.length - cjk
  return cjk + Math.ceil(other / 4)
}

/* budgets per feature class (§22 — small/medium/large, not exact numbers) */
export const FEATURE_BUDGETS = {
  'editor': 4000,
  'chat.quick': 6000,
  'chat.balanced': 14000,
  'chat.deep': 30000,
  'analysis': 24000
} as const

export type FeatureBudget = keyof typeof FEATURE_BUDGETS

export function budgetTokens(text: string, budget: number): { text: string, tokens: number, reduced: boolean } {
  const tokens = estimateTokens(text)
  if (tokens <= budget) return { text, tokens, reduced: false }
  /* proportional character cut — CJK share makes exact token math unstable */
  const ratio = budget / tokens
  return { text: text.slice(0, Math.floor(text.length * ratio)), tokens: budget, reduced: true }
}

export function buildContext(items: BudgetedItem[], budget: number): { context: string, tokens: number, dropped: number } {
  let context = items.map(i => i.text).join('\n')
  let tokens = estimateTokens(context)
  if (tokens <= budget) return { context, tokens, dropped: 0 }

  /* drop from lowest priority (P3 → P0) until under budget (§23) */
  let dropped = 0
  for (let priority = 3; priority >= 0 && tokens > budget; priority--) {
    const keep = items.filter(i => i.priority < priority || i.priority > 3)
    const dropCount = items.length - keep.length
    if (dropCount === 0) continue
    items = keep
    dropped += dropCount
    context = items.map(i => i.text).join('\n')
    tokens = estimateTokens(context)
  }
  if (tokens > budget) {
    const cut = budgetTokens(context, budget)
    context = cut.text
    tokens = cut.tokens
  }
  return { context, tokens, dropped }
}
