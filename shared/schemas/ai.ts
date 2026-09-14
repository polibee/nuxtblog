import { z } from 'zod'

export const AI_PROVIDER_TYPES = ['openai', 'openai_compatible', 'anthropic'] as const

export const aiProviderSchema = z.object({
  name: z.string().trim().min(1).max(80),
  providerType: z.enum(AI_PROVIDER_TYPES).default('openai_compatible'),
  baseUrl: z.string().trim().min(1).max(300),
  /* empty = keep the existing key on update */
  apiKey: z.string().trim().max(300).optional().default(''),
  defaultModel: z.string().trim().min(1).max(100),
  inputPricePerMillion: z.coerce.number().finite().min(0).max(100000).default(0),
  outputPricePerMillion: z.coerce.number().finite().min(0).max(100000).default(0),
  cacheHitPricePerMillion: z.coerce.number().finite().min(0).max(100000).default(0),
  enabled: z.boolean().default(true)
})

export type AiProviderInput = z.infer<typeof aiProviderSchema>

export const EDITOR_AI_FEATURES = [
  'improve',
  'rewrite',
  'shorten',
  'expand',
  'grammar',
  'clarify',
  'summarize',
  'tone',
  'translate',
  'custom'
] as const

export const AI_TONES = ['professional', 'casual', 'technical', 'concise', 'friendly', 'academic'] as const

export const editorAiSchema = z.object({
  feature: z.enum(EDITOR_AI_FEATURES),
  selectedText: z.string().trim().min(1).max(8000),
  instruction: z.string().trim().max(500).optional().default(''),
  tone: z.string().trim().max(30).optional().default(''),
  translateLocale: z.string().trim().max(20).optional().default(''),
  documentTitle: z.string().trim().max(200).optional().default(''),
  locale: z.string().trim().max(20).optional().default('zh-CN')
})

export type EditorAiInput = z.infer<typeof editorAiSchema>
