<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { notifyError } from '~/admin/notifications/notify'
import { SendIcon, SparklesIcon } from 'lucide-vue-next'
import AIConversationSidebar from './assistant/AIConversationSidebar.vue'
import AIToolActivity from './assistant/AIToolActivity.vue'
import AISources from './assistant/AISources.vue'
import AIContextPicker from './assistant/AIContextPicker.vue'
import AIContextInspector from './assistant/AIContextInspector.vue'
import type { ToolActivityItem } from './assistant/types'

/* P32 AI Assistant Workspace (docs/AI组件优化.txt C1+C2): conversation
   sidebar + transcript (tool activity, sources) + context inspector +
   composer with scope/depth/attached context. Presets arrive in C3. */

defineProps<{ resource: { name: string } }>()

const { t } = useI18n()

interface Reference { type: string, id: number, title: string }
interface ContextItem { type: string, id: number, title: string }
interface WorkspaceMessage {
  role: 'user' | 'assistant'
  content: string
  references?: Reference[]
  toolActivity?: ToolActivityItem[]
}
interface Conversation { id: number, title: string, scopeType: string, updatedAt: string }
interface Preset {
  id: number
  name: string
  description: string
  type: 'builtin' | 'custom'
  defaultScope: string
  defaultDepth: string
  suggestedQuestions: string[]
}

const SCOPES = ['site', 'posts', 'pages', 'seo', 'profile', 'store', 'comments', 'media'] as const
const DEPTHS = ['quick', 'balanced', 'deep'] as const

/* §27 suggested questions per scope (empty state fallback) */
const SUGGESTION_KEYS: Record<string, string[]> = {
  site: ['auditSite', 'findSeoProblems', 'reviewProfile', 'findContentGaps'],
  posts: ['auditContent', 'findLongPosts', 'findInternalLinks'],
  pages: ['auditPages', 'findPageGaps'],
  seo: ['findSeoProblems', 'findMissingMeta', 'prioritizeSeo'],
  profile: ['reviewProfile', 'reviewProjects', 'reviewFocus'],
  store: ['reviewProducts', 'findProductGaps', 'compareProducts'],
  comments: ['commentInsights', 'findPendingComments'],
  media: ['mediaAudit', 'findMissingAlt']
}

const conversations = ref<Conversation[]>([])
const conversationId = ref<number | null>(null)
const messages = ref<WorkspaceMessage[]>([])
const scope = ref<string>('site')
const depth = ref<string>('balanced')
const presets = ref<Preset[]>([])
const presetId = ref<number | null>(null)
const attached = ref<ContextItem[]>([])
const input = ref('')
const sending = ref(false)
const error = ref('')
const lastContextTokens = ref<number | null>(null)
const transcriptEl = ref<HTMLElement | null>(null)

const activePreset = computed(() => presets.value.find(p => p.id === presetId.value) ?? null)

/* §14/28: preset suggestions win; scope suggestions are the fallback */
const suggestions = computed(() => {
  const presetSuggestions = activePreset.value?.suggestedQuestions ?? []
  if (presetSuggestions.length > 0) return presetSuggestions
  return (SUGGESTION_KEYS[scope.value] ?? []).map(key => t(`res.aichat.suggest_${key}`))
})

async function loadPresets(): Promise<void> {
  try {
    const res = await $fetch<{ presets: Preset[] }>('/api/admin/ai/presets')
    presets.value = res.presets ?? []
  } catch {
    presets.value = []
  }
}

/* §15/65: preset defaults are defaults, not forced */
function onPresetChange(): void {
  const preset = activePreset.value
  if (!preset) return
  scope.value = preset.defaultScope
  depth.value = preset.defaultDepth
}

async function loadConversations(): Promise<void> {
  try {
    const res = await $fetch<{ conversations: Conversation[] }>('/api/admin/ai/chat/conversations')
    conversations.value = res.conversations ?? []
  } catch {
    conversations.value = []
  }
}

function newChat(): void {
  conversationId.value = null
  messages.value = []
  error.value = ''
  lastContextTokens.value = null
}

async function openConversation(id: number): Promise<void> {
  error.value = ''
  try {
    const res = await $fetch<{ messages: WorkspaceMessage[] }>('/api/admin/ai/chat/messages', {
      query: { conversationId: id }
    })
    conversationId.value = id
    messages.value = res.messages ?? []
    lastContextTokens.value = null
    const conv = conversations.value.find(c => c.id === id)
    if (conv) scope.value = conv.scopeType
    await nextTick()
    transcriptEl.value?.scrollTo({ top: transcriptEl.value.scrollHeight })
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function removeConversation(id: number): Promise<void> {
  try {
    await $fetch(`/api/admin/ai/chat/conversations/${id}`, { method: 'DELETE' })
    if (conversationId.value === id) newChat()
    await loadConversations()
  } catch (e) {
    notifyError(t('res.aichat.error'), (e as Error).message)
  }
}

function scrollToBottom(): void {
  transcriptEl.value?.scrollTo({ top: transcriptEl.value.scrollHeight })
}

async function send(text?: string): Promise<void> {
  const message = (text ?? input.value).trim()
  if (!message || sending.value) return
  sending.value = true
  error.value = ''
  input.value = ''
  messages.value.push({ role: 'user', content: message })
  await nextTick()
  scrollToBottom()
  try {
    const res = await $fetch<{
      conversationId: number
      reply: string
      references?: Reference[]
      toolActivity?: ToolActivityItem[]
      contextTokens?: number
    }>('/api/admin/ai/chat', {
      method: 'POST',
      body: { conversationId: conversationId.value, message, scopeType: scope.value, depth: depth.value, presetId: presetId.value, context: attached.value }
    })
    conversationId.value = res.conversationId
    messages.value.push({
      role: 'assistant',
      content: res.reply,
      references: res.references,
      toolActivity: res.toolActivity
    })
    lastContextTokens.value = res.contextTokens ?? null
    await loadConversations()
  } catch (e: unknown) {
    const err = e as Error & { data?: { code?: string } }
    error.value = err.data?.code === 'AI_PROVIDER_NOT_CONFIGURED'
      ? t('res.aichat.noProvider')
      : (err.message || t('res.aichat.error'))
  } finally {
    sending.value = false
    await nextTick()
    scrollToBottom()
  }
}

onMounted(() => {
  loadConversations()
  loadPresets()
})
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-[220px,minmax(0,1fr),220px]">
    <!-- conversations -->
    <div class="max-xl:hidden">
      <AIConversationSidebar
        :conversations="conversations"
        :active-id="conversationId"
        @select="openConversation"
        @new-chat="newChat"
        @remove="removeConversation"
      />
    </div>

    <!-- transcript + composer -->
    <div class="flex min-h-[70vh] flex-col rounded-xl border">
      <div
        ref="transcriptEl"
        class="flex-1 space-y-5 overflow-y-auto p-4"
      >
        <!-- §27/28 empty state -->
        <div
          v-if="messages.length === 0"
          class="mx-auto max-w-lg space-y-4 py-10 text-center"
        >
          <SparklesIcon class="mx-auto h-8 w-8 text-primary" />
          <div>
            <p class="text-lg font-semibold">
              {{ t('res.aichat.emptyTitle') }}
            </p>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t('res.aichat.emptySubtitle') }}
            </p>
          </div>
          <div class="space-y-1.5">
            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {{ t('res.aichat.suggested') }}
            </p>
            <button
              v-for="suggestion in suggestions"
              :key="suggestion"
              type="button"
              class="block w-full rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
              @click="send(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>

        <template
          v-for="(msg, i) in messages"
          :key="i"
        >
          <div
            v-if="msg.role === 'user'"
            class="flex justify-end"
          >
            <p class="max-w-[80%] whitespace-pre-line rounded-xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
              {{ msg.content }}
            </p>
          </div>
          <div
            v-else
            class="space-y-2"
          >
            <!-- §24-25 tool activity above the answer -->
            <AIToolActivity
              v-if="msg.toolActivity?.length"
              :items="msg.toolActivity"
            />
            <p class="whitespace-pre-line text-[15px] leading-relaxed">
              {{ msg.content }}
            </p>
            <AISources
              v-if="msg.references?.length"
              :references="msg.references"
            />
          </div>
        </template>

        <p
          v-if="sending"
          class="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <SparklesIcon class="h-4 w-4 animate-pulse text-primary" />
          {{ t('res.aichat.thinking') }}
        </p>
      </div>

      <!-- §5-6 composer: scope + depth + context + input -->
      <div class="space-y-2 border-t p-3">
        <p
          v-if="error"
          class="text-xs text-destructive"
        >
          {{ error }}
        </p>
        <AIContextPicker
          :attached="attached"
          @attach="attached.push($event)"
          @detach="attached = attached.filter(a => a !== $event)"
        />
        <div class="flex items-end gap-2">
          <textarea
            v-model="input"
            rows="2"
            :placeholder="t('res.aichat.placeholder')"
            class="min-h-[44px] flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm"
            @keydown.enter.exact.prevent="send()"
          />
          <UiButton
            :disabled="sending || !input.trim()"
            @click="send()"
          >
            <SendIcon class="h-4 w-4" />
          </UiButton>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <select
            v-model="presetId"
            class="h-7 max-w-44 rounded-md border bg-background px-1.5"
            :aria-label="t('res.aipreset.preset')"
            @change="onPresetChange"
          >
            <option :value="null">
              {{ t('res.aipreset.preset') }}: {{ t('res.aipreset.general') }}
            </option>
            <option
              v-for="preset in presets"
              :key="preset.id"
              :value="preset.id"
            >
              {{ preset.name }}
            </option>
          </select>
          <select
            v-model="scope"
            class="h-7 rounded-md border bg-background px-1.5"
            :aria-label="t('res.aichat.scope')"
          >
            <option
              v-for="s in SCOPES"
              :key="s"
              :value="s"
            >
              {{ t(`res.aichat.scope_${s}`) }}
            </option>
          </select>
          <select
            v-model="depth"
            class="h-7 rounded-md border bg-background px-1.5"
            :aria-label="t('res.aichat.inspectorDepth')"
          >
            <option
              v-for="d in DEPTHS"
              :key="d"
              :value="d"
            >
              {{ t(`res.aichat.depth_${d}`) }}
            </option>
          </select>
          <span class="text-muted-foreground">{{ t('res.aichat.readOnlyHint') }}</span>
        </div>
      </div>
    </div>

    <!-- context inspector (§36-37), collapsible on smaller screens -->
    <div class="max-xl:hidden">
      <div class="rounded-xl border p-4">
        <p class="mb-3 text-sm font-semibold">
          {{ t('res.aichat.inspectorTitle') }}
        </p>
        <AIContextInspector
          :scope="scope"
          :depth="depth"
          :attached="attached"
          :context-tokens="lastContextTokens"
        />
      </div>
    </div>
  </div>
</template>
