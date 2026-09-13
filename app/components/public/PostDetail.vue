<template>
  <article class="space-y-6">
    <header>
      <h1 class="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {{ post.title }}
      </h1>
      <p
        v-if="post.excerpt"
        class="mt-3 text-[15px] leading-relaxed text-muted-foreground"
      >
        {{ post.excerpt }}
      </p>
      <div class="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <span
          v-if="post.authorName"
          class="font-medium"
        >{{ post.authorName }}</span>
        <span>·</span>
        <time>{{ formatDate(post.publishedAt) }}</time>
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
      class="w-full rounded-xl border object-cover"
    >

    <!-- whitelisted by server-side sanitize-html at write time -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      class="prose prose-neutral dark:prose-invert max-w-none"
      v-html="post.content"
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
      class="prose prose-neutral dark:prose-invert max-w-none"
      v-html="post.paidContent"
    />

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

const buying = ref(false)
const error = ref('')

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
