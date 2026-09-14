<template>
  <article class="space-y-6">
    <header>
      <h1 class="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {{ post.title }}
      </h1>
      <div class="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <span
          v-if="post.authorName"
          class="font-medium"
        >{{ post.authorName }}</span>
        <span>·</span>
        <time>{{ formatDate(post.publishedAt, localeCode) }}</time>
        <span
          v-if="readingMinutes"
        >· {{ t('posts.meta.readingTime', { n: readingMinutes }) }}</span>
        <span
          v-if="post.views"
        >· {{ t('posts.meta.views', { n: post.views }) }}</span>
      </div>
    </header>

    <slot name="toc-top" />

    <img
      v-if="post.coverUrl"
      :src="post.coverUrl"
      :alt="post.title"
      class="article-cover rounded-xl"
      role="button"
      tabindex="0"
      :aria-label="post.title"
      @click="openPreview(post.coverUrl)"
      @keydown.enter="openPreview(post.coverUrl)"
      @keydown.space.prevent="openPreview(post.coverUrl)"
    >

    <!-- whitelisted by server-side sanitize-html at write time -->
    <!-- eslint-disable-next-line vue/no-v-html -->
        <div
      class="article-prose prose prose-neutral dark:prose-invert max-w-none"
      v-html="post.content"
      @click="onContentClick"
    />

    <!-- paywall: paid block withheld / members-only body -->
    <div
      v-if="post.locked"
      class="rounded-xl border border-primary/40 bg-primary/5 p-6 text-center"
    >
      <p class="text-sm font-medium">
        {{ post.accessType === 'members'
          ? t('posts.access.membersOnly')
          : t('posts.access.paidLocked') }}
      </p>
      <button
        v-if="post.accessType === 'paid' && post.price"
        type="button"
        class="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        @click="buy"
      >
        {{ t('posts.actions.buyFor', { price: formatMoney(post.price.priceMinor, post.price.currency) }) }}
      </button>
      <p
        v-if="error"
        class="mt-3 text-sm text-destructive"
      >
        {{ error }}
      </p>
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      v-else-if="post.paidContent"
      class="article-prose prose prose-neutral dark:prose-invert max-w-none"
      v-html="post.paidContent"
      @click="onContentClick"
    />

    <Teleport to="body">
      <div
        v-if="previewImage"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        role="dialog"
        aria-modal="true"
        @click.self="previewImage = ''"
      >
        <button
          type="button"
          class="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
          :aria-label="t('common.actions.close')"
          @click="previewImage = ''"
        >
          ×
        </button>
        <img
          :src="previewImage"
          :alt="post.title"
          class="article-lightbox-image object-contain"
        >
      </div>
    </Teleport>

    <footer
      v-if="post.tags.length"
      class="flex flex-wrap items-center gap-2 border-t pt-4"
    >
      <span class="text-xs text-muted-foreground">{{ t('posts.labels.tags') }}</span>
      <NuxtLink
        v-for="tag in post.tags"
        :key="tag.alias"
        :to="publicPath(`/tag/${tag.alias}`)"
        class="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground transition-colors hover:bg-accent"
      >
        {{ tag.name }}
      </NuxtLink>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { PublicPostDetail } from '#shared/types/post'
import { formatMoney } from '~/utils/money'
import { formatDate } from '~/utils/blog'

const props = defineProps<{
  post: PublicPostDetail
  readingMinutes?: number
}>()

const { t } = useI18n()
const { localeCode, publicPath } = useLocale()

const buying = ref(false)
const error = ref('')
const previewImage = ref('')

interface XWidgets {
  widgets?: { load: (element?: Element) => void }
}

function loadXWidgets(): void {
  if (!import.meta.client || !document.querySelector('.article-embed-x')) return
  const win = window as typeof window & { twttr?: XWidgets }
  if (win.twttr?.widgets) {
    win.twttr.widgets.load()
    return
  }
  if (document.querySelector('script[data-article-x-widgets]')) return
  const script = document.createElement('script')
  script.src = 'https://platform.twitter.com/widgets.js'
  script.async = true
  script.dataset.articleXWidgets = 'true'
  document.head.appendChild(script)
}

onMounted(() => nextTick(loadXWidgets))
watch(() => [props.post.content, props.post.paidContent], () => nextTick(loadXWidgets))

function onContentClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof HTMLImageElement && target.currentSrc) {
    openPreview(target.currentSrc)
  }
}

function openPreview(src: string): void {
  if (src) previewImage.value = src
}

async function buy(): Promise<void> {
  const price = props.post.price
  if (!price || buying.value) return
  buying.value = true
  error.value = ''
  try {
    const created = await $fetch<{ orderNumber: string }>('/api/public/orders', {
      method: 'POST',
      body: { productAlias: price.productAlias, quantity: 1, currency: price.currency }
    })
    await navigateTo(`/checkout/${created.orderNumber}`)
  } catch (e) {
    error.value = (e as Error & { data?: { message?: string } }).data?.message
      || (e as Error).message
      || t('posts.errors.orderFailed')
  }
  finally {
    buying.value = false
  }
}
</script>

<style scoped>
.article-prose {
  overflow-wrap: anywhere;
}

.article-prose :deep(img) {
  display: block;
  width: auto;
  max-width: min(100%, 32rem);
  max-height: 24rem;
  height: auto;
  margin: 1.5rem auto;
  cursor: zoom-in;
  object-fit: contain;
  border-radius: 0.75rem;
}

.article-cover {
  display: block;
  width: min(100%, 42rem);
  max-height: 24rem;
  margin-inline: auto;
  cursor: zoom-in;
  object-fit: contain;
}

.article-lightbox-image {
  width: min(92vw, 72rem);
  height: min(88vh, 48rem);
  max-width: none;
  max-height: none;
}

.article-prose :deep(a) {
  overflow-wrap: anywhere;
  color: hsl(var(--primary));
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.article-prose :deep(.article-embed-link) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  width: min(100%, 34rem);
  margin: 2rem auto;
  padding: 1.125rem 1.25rem;
  overflow: hidden;
  border: 1px solid rgb(100 116 139 / 22%);
  border-radius: 1rem;
  background: hsl(var(--card) / 0.8);
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}

.article-prose :deep(.article-embed-site) {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.7rem;
}

.article-prose :deep(.article-embed-site strong) {
  overflow: hidden;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-prose :deep(.article-embed:hover) {
  border-color: hsl(var(--primary) / 0.35);
  background: hsl(var(--accent) / 0.35);
  box-shadow: 0 6px 18px rgb(15 23 42 / 8%);
}

.article-prose :deep(.article-embed-icon) {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.article-prose :deep(.article-embed-copy) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.3rem;
}

.article-prose :deep(.article-embed-copy strong) {
  color: hsl(var(--foreground));
  font-size: 0.95rem;
  line-height: 1.3;
}

.article-prose :deep(.article-embed-meta) {
  color: hsl(var(--muted-foreground));
  font-size: 0.78rem;
}

.article-prose :deep(.article-embed-action) {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 auto;
  padding: 0.35rem 0.65rem;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  color: hsl(var(--primary));
  background: hsl(var(--background));
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 160ms ease, border-color 160ms ease;
}

.article-prose :deep(.article-embed-action:hover) {
  border-color: hsl(var(--primary) / 0.4);
  background: hsl(var(--accent));
  text-decoration: none;
}

.article-prose :deep(.article-embed-inline) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0.15rem;
  padding: 0.15rem 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  color: hsl(var(--primary));
  background: hsl(var(--card));
  font-size: 0.85em;
  font-weight: 600;
  text-decoration: none;
  vertical-align: baseline;
}

.article-prose :deep(.article-embed-inline .article-embed-icon) {
  width: 1.1rem;
  height: 1.1rem;
  border: 0;
  background: transparent;
  font-size: 0.75rem;
}

.article-prose :deep(.article-embed-inline:hover) {
  border-color: hsl(var(--primary) / 0.4);
  background: hsl(var(--accent));
  text-decoration: none;
}

@media (max-width: 640px) {
  .article-prose :deep(.article-embed-link) {
    align-items: center;
    padding: 0.9rem 1rem;
  }

  .article-prose :deep(img) {
    max-width: 100%;
    max-height: 17rem;
  }

  .article-cover {
    width: 100%;
    max-height: 17rem;
  }
}
</style>
