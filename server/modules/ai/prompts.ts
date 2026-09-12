/* Prompt registry (AI 集成文档 §75/76): editor writing features.
   System prompt fixes the assistant persona; the user message carries
   the selected text and the feature instruction. Prompts never live in
   Vue components. */

/* P31 prompt versions (缓存优化 §38): bump when the prompt wording
   changes — old cached artifacts must not be served for a new prompt. */
export const EDITOR_PROMPT_VERSION = 1
export const CHAT_PROMPT_VERSION = 1

export interface PromptMessages {
  system: string
  user: string
}

export type EditorFeature
  = | 'improve'
    | 'rewrite'
    | 'shorten'
    | 'expand'
    | 'grammar'
    | 'clarify'
    | 'summarize'
    | 'tone'
    | 'translate'
    | 'custom'

const FEATURE_INSTRUCTIONS: Partial<Record<EditorFeature, string>> = {
  improve: 'Improve the writing quality of the text. Keep the original meaning, language and tone.',
  rewrite: 'Rewrite the text with different wording while preserving the meaning.',
  shorten: 'Shorten the text. Remove redundancy but keep every key point.',
  expand: 'Expand the text with relevant detail and examples. Do not invent facts.',
  grammar: 'Fix grammar, spelling and punctuation errors only. Do not change the style.',
  clarify: 'Make the text clearer and easier to understand.',
  summarize: 'Summarize the text in 1-2 sentences.'
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: 'Rewrite the text in a professional tone.',
  casual: 'Rewrite the text in a casual, conversational tone.',
  technical: 'Rewrite the text in a technical, precise tone.',
  concise: 'Rewrite the text to be as concise as possible.',
  friendly: 'Rewrite the text in a warm, friendly tone.',
  academic: 'Rewrite the text in an academic tone.'
}

export function buildEditorPrompt(input: {
  feature: EditorFeature
  selectedText: string
  instruction?: string
  tone?: string
  translateLocale?: string
  documentTitle?: string
  locale?: string
}): PromptMessages {
  let instruction: string
  if (input.feature === 'custom') {
    instruction = input.instruction?.trim() || 'Improve the text.'
  } else if (input.feature === 'translate') {
    instruction = `Translate the text into ${input.translateLocale || 'English'}. Output only the translation.`
  } else if (input.feature === 'tone') {
    instruction = TONE_INSTRUCTIONS[input.tone ?? 'professional'] ?? TONE_INSTRUCTIONS.professional!
  } else {
    instruction = FEATURE_INSTRUCTIONS[input.feature] ?? FEATURE_INSTRUCTIONS.improve!
  }

  const contextParts: string[] = []
  if (input.documentTitle) contextParts.push(`Document title: ${input.documentTitle}`)
  if (input.locale) contextParts.push(`Content language: ${input.locale}`)
  const context = contextParts.length > 0 ? `${contextParts.join('\n')}\n\n` : ''

  return {
    system: 'You are a professional writing assistant inside a blog CMS. Apply the requested operation to the given text. Respond with the resulting text only — no explanations, no quotes, no markdown fences.',
    user: `${context}Operation: ${instruction}\n\nText:\n${input.selectedText}`
  }
}
