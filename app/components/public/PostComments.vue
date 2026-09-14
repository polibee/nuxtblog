<script setup lang="ts">
import { MessageSquareIcon } from 'lucide-vue-next'
import type { PublicComment } from '#shared/schemas/comment'
import PostCommentNode from './PostCommentNode.vue'

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

type TurnstileWidgetOptions = {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileWidgetOptions) => string | number
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/* Modern comment section (前端评论区优化.txt P0): thread layout without
   cards, border-left connector, inline reply composers, collapsed root
   composer, permalink highlight, nesting capped at 3 visual levels.
   The existing Nitro comment API is kept as-is. */

const props = defineProps<{
  postAlias: string
  commentsOpen: boolean
}>()

const { t } = useI18n()
const auth = useAuthStore()

const MAX_CHARS = 3000
const INITIAL_THREADS = 10
const MAX_INDENT = 3

const comments = ref<PublicComment[]>([])
const loading = ref(true)
const authReady = ref(false)

const sort = ref<'newest' | 'oldest'>('newest')
const visibleCount = ref(INITIAL_THREADS)

/* root composer state */
const composerOpen = ref(false)
const name = ref('')
const email = ref('')
const website = ref('')
const turnstileToken = ref('')
const turnstileSiteKey = ref('')
const turnstileError = ref(false)
const turnstileContainer = ref<HTMLElement | null>(null)
const turnstileWidgetId = ref<string | number | null>(null)
const content = ref('')
const submitting = ref(false)
const error = ref('')

let turnstileScriptPromise: Promise<void> | null = null

/* inline reply state */
const replyTarget = ref<PublicComment | null>(null)
const replyContent = ref('')
const replySubmitting = ref(false)

const highlightedId = ref<number | null>(null)

/* ---------- data ---------- */

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await $fetch<{ comments: PublicComment[] }>(`/api/public/posts/${props.postAlias}/comments`)
    comments.value = res.comments
  } catch {
    comments.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await auth.fetchMe()
  authReady.value = true
  await load()
  await nextTick()
  focusPermalink()
})

const sortedComments = computed(() => {
  const list = [...comments.value]
  return sort.value === 'oldest' ? list.reverse() : list
})

const visibleComments = computed(() => sortedComments.value.slice(0, visibleCount.value))

function loadMore(): void {
  visibleCount.value += INITIAL_THREADS
}

/* ---------- helpers ---------- */

const AVATAR_CLASSES = [
  'bg-primary/10 text-primary',
  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  'bg-violet-500/10 text-violet-600 dark:text-violet-400'
]

function avatarClass(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return AVATAR_CLASSES[hash % AVATAR_CLASSES.length]!
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return t('public.comments.time.now')
  if (minutes < 60) return t('public.comments.time.minutes', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('public.comments.time.hours', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('public.comments.time.days', { n: days })
  return new Date(iso).toLocaleDateString()
}

function indentClass(depth: number): string {
  if (depth <= 0) return ''
  const level = Math.min(depth, MAX_INDENT)
  return level === 1 ? 'ml-5 sm:ml-8' : 'ml-5 sm:ml-16'
}

function loadTurnstileScript(): Promise<void> {
  if (!import.meta.client || window.turnstile) return Promise.resolve()
  if (turnstileScriptPromise) return turnstileScriptPromise

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
    const script = existing ?? document.createElement('script')
    const cleanup = (): void => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }
    const handleLoad = (): void => {
      cleanup()
      if (window.turnstile) resolve()
      else reject(new Error('Turnstile API unavailable'))
    }
    const handleError = (): void => {
      cleanup()
      reject(new Error('Turnstile script failed to load'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  })

  void turnstileScriptPromise.catch(() => {
    turnstileScriptPromise = null
  })
  return turnstileScriptPromise
}

function setTurnstileError(): void {
  turnstileToken.value = ''
  turnstileError.value = true
  error.value = t('public.comments.failed')
}

async function initializeTurnstile(): Promise<void> {
  if (!import.meta.client || auth.user || turnstileWidgetId.value !== null) return

  let settings: Record<string, string | number | boolean>
  try {
    settings = await $fetch<Record<string, string | number | boolean>>('/api/public-settings')
  } catch {
    return
  }

  const configuredSiteKey = settings['comments.turnstile_site_key']
  const siteKey = typeof configuredSiteKey === 'string' ? configuredSiteKey.trim() : ''
  if (!siteKey) return

  turnstileSiteKey.value = siteKey
  try {
    await loadTurnstileScript()
    await nextTick()
    if (!turnstileContainer.value || !window.turnstile || turnstileWidgetId.value !== null) return

    turnstileWidgetId.value = window.turnstile.render(turnstileContainer.value, {
      sitekey: siteKey,
      callback: (token) => {
        turnstileToken.value = token
        turnstileError.value = false
        error.value = ''
      },
      'expired-callback': setTurnstileError,
      'error-callback': setTurnstileError
    })
  } catch {
    setTurnstileError()
  }
}

/* ---------- root composer ---------- */

async function submitRoot(): Promise<void> {
  submitting.value = true
  error.value = ''
  try {
    const body: Record<string, unknown> = { content: content.value, parentId: null }
    if (!auth.user) {
      body.name = name.value
      body.email = email.value
      body.website = website.value
      body.turnstileToken = turnstileToken.value
    }
    const res = await $fetch<{ status?: string }>(`/api/public/posts/${props.postAlias}/comments`, { method: 'POST', body })
    content.value = ''
    composerOpen.value = false
    if (res.status && res.status !== 'approved') {
      pendingNotice.value = t('public.comments.thanks')
    }
    await load()
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? t('public.comments.failed')
  } finally {
    submitting.value = false
  }
}

/* ---------- replies ---------- */

function openReply(comment: PublicComment): void {
  replyTarget.value = comment
  replyContent.value = ''
  composerOpen.value = false
  nextTick(() => {
    document.getElementById(`reply-composer-${comment.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function submitReply(): Promise<void> {
  const target = replyTarget.value
  if (!target) return
  replySubmitting.value = true
  error.value = ''
  try {
    const body: Record<string, unknown> = { content: replyContent.value, parentId: target.id }
    if (!auth.user) {
      body.name = name.value
      body.email = email.value
      body.website = website.value
      body.turnstileToken = turnstileToken.value
    }
    const res = await $fetch<{ status?: string }>(`/api/public/posts/${props.postAlias}/comments`, { method: 'POST', body })
    if (res.status && res.status !== 'approved') {
      pendingNotice.value = t('public.comments.thanks')
    }
    await load()
    replyTarget.value = null
    replyContent.value = ''
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? t('public.comments.failed')
  } finally {
    replySubmitting.value = false
  }
}

function insertReply(parentId: number, reply: PublicComment): void {
  const walk = (list: PublicComment[]): boolean => {
    for (const item of list) {
      if (item.id === parentId) {
        item.children.push(reply)
        return true
      }
      if (walk(item.children)) return true
    }
    return false
  }
  walk(comments.value)
}

/* ---------- permalink highlight (§47-49) ---------- */

function focusPermalink(): void {
  const hash = window.location.hash
  const match = hash.match(/^#comment-(\d+)$/)
  if (!match) return
  const id = Number(match[1])
  highlightedId.value = id
  nextTick(() => {
    document.getElementById(`comment-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => {
      highlightedId.value = null
    }, 2000)
  })
}

function copyPermalink(comment: PublicComment): void {
  const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`
  navigator.clipboard.writeText(url).then(() => {
    notify(t('public.comments.linkCopied'))
  }).catch(() => undefined)
}

/* reply collapse: show first 3 replies per thread */
const expandedThreads = ref<Set<number>>(new Set())
const REPLY_PREVIEW = 3

function visibleReplies(comment: PublicComment): PublicComment[] {
  if (expandedThreads.value.has(comment.id)) return comment.children
  return comment.children.slice(0, REPLY_PREVIEW)
}

function hiddenReplyCount(comment: PublicComment): number {
  return Math.max(comment.children.length - REPLY_PREVIEW, 0)
}

function toggleThread(comment: PublicComment): void {
  const set = new Set(expandedThreads.value)
  if (set.has(comment.id)) set.delete(comment.id)
  else set.add(comment.id)
  expandedThreads.value = set
}

function notify(message: string): void {
  /* lightweight inline notice */
  copiedNotice.value = message
  window.setTimeout(() => {
    copiedNotice.value = ''
  }, 2000)
}

const copiedNotice = ref('')
const pendingNotice = ref('')

onMounted(() => {
  void props.commentsOpen
})
</script>

<template>
  <section
    id="comments"
    class="space-y-8 border-t pt-8"
  >
    <!-- header + sort (§57) -->
    <div class="flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <MessageSquareIcon class="h-5 w-5" />
        {{ t('public.comments.title') }}
        <span
          v-if="comments.length"
          class="text-sm font-normal text-muted-foreground"
        >{{ comments.length }}</span>
      </h2>
      <select
        v-model="sort"
        class="h-8 rounded-md border bg-background px-2 text-xs text-muted-foreground"
      >
        <option value="newest">
          {{ t('public.comments.sortNewest') }}
        </option>
        <option value="oldest">
          {{ t('public.comments.sortOldest') }}
        </option>
      </select>
    </div>

    <!-- root composer: collapsed placeholder → focus expands (§6/7) -->
    <div
      v-if="commentsOpen"
      class="rounded-xl border"
    >
      <form
        class="p-3 sm:p-4"
        @submit.prevent="submitRoot"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            :class="auth.user ? avatarClass(auth.user.email || 'u') : 'bg-muted text-muted-foreground'"
          >
            {{ (auth.user?.email ?? 'W').slice(0, 1).toUpperCase() }}
          </div>
          <textarea
            v-model="content"
            :placeholder="t('public.comments.placeholder')"
            rows="3"
            maxlength="3000"
            class="min-h-9 w-full resize-y rounded-md border-0 bg-transparent px-1 py-1 text-sm leading-relaxed outline-none focus:ring-0"
            @focus="composerOpen = true; void initializeTurnstile()"
          />
        </div>

        <template v-if="composerOpen || content">
          <div
            v-if="authReady && !auth.user"
            class="mb-3 ml-12 grid gap-3 sm:grid-cols-2"
          >
            <input
              v-model="name"
              :placeholder="t('public.comments.name')"
              required
              class="h-9 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="email"
              type="email"
              :placeholder="t('public.comments.email')"
              required
              class="h-9 rounded-md border bg-background px-3 text-sm"
            >
            <input
              v-model="website"
              type="url"
              :placeholder="t('public.comments.website')"
              autocomplete="url"
              class="h-9 rounded-md border bg-background px-3 text-sm"
            >
            <div
              v-if="turnstileSiteKey"
              ref="turnstileContainer"
              class="sm:col-span-2"
            />
          </div>
          <div class="flex items-center justify-end gap-3 border-t pt-3">
            <span class="mr-auto text-xs text-muted-foreground">
              {{ content.length }} / {{ MAX_CHARS }}
            </span>
            <button
              type="button"
              class="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent"
              @click="composerOpen = false; content = ''"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="submit"
              class="h-8 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              :disabled="submitting || !content.trim()"
            >
              {{ submitting ? t('public.comments.submitting') : t('public.comments.submit') }}
            </button>
          </div>
        </template>
      </form>
    </div>

    <p
      v-if="pendingNotice"
      class="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
    >
      {{ pendingNotice }}
    </p>

    <p
      v-if="copiedNotice"
      class="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
    >
      {{ copiedNotice }}
    </p>

    <p
      v-if="error"
      class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </p>

    <!-- skeleton (§59) -->
    <div
      v-if="loading"
      class="space-y-6"
    >
      <div
        v-for="i in 2"
        :key="i"
        class="flex gap-3"
      >
        <UiSkeleton class="h-9 w-9 rounded-full" />
        <div class="flex-1 space-y-2">
          <UiSkeleton class="h-3 w-32" />
          <UiSkeleton class="h-3 w-full" />
          <UiSkeleton class="h-3 w-2/3" />
        </div>
      </div>
    </div>

    <!-- empty state (§58) -->
    <div
      v-else-if="comments.length === 0 && commentsOpen"
      class="text-sm text-muted-foreground"
    >
      <p>{{ t('public.comments.none') }}</p>
      <p class="mt-0.5 text-xs">
        {{ t('public.comments.beFirst') }}
      </p>
    </div>

    <!-- thread list -->
    <ul class="space-y-9">
      <li
        v-for="thread in visibleComments"
        :key="thread.id"
        class="space-y-5"
      >
        <!-- root comment -->
        <div
          :id="`comment-${thread.id}`"
          class="flex gap-3 transition-all duration-700"
          :class="highlightedId === thread.id ? 'rounded-lg bg-muted/40 ring-1 ring-primary/20' : ''"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            :class="avatarClass(thread.authorName)"
          >
            <img
              v-if="thread.avatarUrl"
              :src="thread.avatarUrl"
              alt=""
              class="h-full w-full rounded-full object-cover"
            >
            <template v-else>{{ thread.authorName.slice(0, 1).toUpperCase() }}</template>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm">
              <a
                v-if="thread.websiteUrl"
                :href="thread.websiteUrl"
                target="_blank"
                rel="nofollow noopener noreferrer"
                class="font-semibold hover:underline"
              >{{ thread.authorName }}</a>
              <span v-else class="font-semibold">{{ thread.authorName }}</span>
              <span
                v-for="badge in thread.badges"
                :key="`${thread.id}-${badge.key}`"
                class="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-medium text-primary"
                :title="badge.description"
              >
                {{ badge.name }}
              </span>
              <span class="ml-1.5 text-xs text-muted-foreground">{{ relativeTime(thread.createdAt) }}</span>
              <span v-if="thread.browserName || thread.osName" class="ml-1.5 text-xs text-muted-foreground">
                · {{ [thread.browserName, thread.osName].filter(Boolean).join(' / ') }}
              </span>
            </p>
            <p class="mt-1 text-[15px] leading-[1.7]">
              {{ thread.content }}
            </p>
            <div class="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <button
                type="button"
                class="hover:text-foreground"
                @click="openReply(thread)"
              >
                {{ t('public.comments.reply') }}
              </button>
              <button
                type="button"
                class="hover:text-foreground"
                :title="t('public.comments.copyLink')"
                @click="copyPermalink(thread)"
              >
                ···
              </button>
            </div>
          </div>
        </div>

        <!-- replies: thread line (§14/15) -->
        <div
          v-if="thread.children.length"
          :class="[indentClass(1), 'space-y-4 border-l border-muted pl-5']"
        >
          <PostCommentNode
            v-for="reply in visibleReplies(thread)"
            :key="reply.id"
            :comment="reply"
            :depth="1"
            :highlighted-id="highlightedId"
            :reply-target="replyTarget"
            :reply-content="replyContent"
            :reply-submitting="replySubmitting"
            :expanded-threads="expandedThreads"
            :indent-class="indentClass"
            :avatar-class="avatarClass"
            :relative-time="relativeTime"
            :visible-replies="visibleReplies"
            :hidden-reply-count="hiddenReplyCount"
            :open-reply="openReply"
            :copy-permalink="copyPermalink"
            :toggle-thread="toggleThread"
            :submit-reply="submitReply"
            @update:reply-content="replyContent = $event"
            @cancel-reply="replyTarget = null"
          />
        </div>

        <!-- inline reply composer for the thread root -->
        <div
          v-if="replyTarget?.id === thread.id"
          :id="`reply-composer-${thread.id}`"
          class="ml-13 rounded-lg border p-3 sm:ml-12"
        >
          <p class="mb-2 text-xs text-muted-foreground">
            {{ t('public.comments.replyingToName', { name: thread.authorName }) }}
            <button
              type="button"
              class="ml-1 text-destructive hover:underline"
              @click="replyTarget = null"
            >
              {{ t('common.cancel') }}
            </button>
          </p>
          <form
            class="space-y-2"
            @submit.prevent="submitReply"
          >
            <textarea
              v-model="replyContent"
              rows="2"
              maxlength="3000"
              :placeholder="t('public.comments.replyPlaceholder', { name: thread.authorName })"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
              required
            />
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent"
                @click="replyTarget = null"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                class="h-8 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                :disabled="replySubmitting || !replyContent.trim()"
              >
                {{ replySubmitting ? t('public.comments.submitting') : t('public.comments.reply') }}
              </button>
            </div>
          </form>
        </div>
      </li>
    </ul>

    <!-- load more threads (§60) -->
    <button
      v-if="visibleComments.length < sortedComments.length"
      type="button"
      class="w-full rounded-lg border py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      @click="loadMore"
    >
      {{ t('public.comments.loadMore') }}
    </button>

    <!-- closed comments -->
    <p
      v-if="!commentsOpen"
      class="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground"
    >
      {{ t('public.comments.closed') }}
    </p>
  </section>
</template>
