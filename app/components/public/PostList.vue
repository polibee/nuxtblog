<script setup lang="ts">
import { formatDate, formatViews, splitHighlight } from '~/utils/blog'
import type { PublicPostSummary } from '#shared/types/post'

const props = defineProps<{
  posts: PublicPostSummary[]
  highlight?: string
}>()

const { t } = useI18n()

function segments(text: string): Array<{ text: string, hit: boolean }> {
  return splitHighlight(text, props.highlight ?? '')
}
</script>

<template>
  <div class="space-y-4">
    <UiEmpty v-if="posts.length === 0">
      <template #title>
        {{ t('posts.empty') }}
      </template>
    </UiEmpty>

    <article
      v-for="post in posts"
      :key="post.alias"
      class="group rounded-xl border transition-colors hover:bg-accent/30"
    >
      <NuxtLink
        :to="publicPath(`/posts/${post.alias}`)"
        :aria-label="t('posts.actions.open', { title: post.title })"
        class="flex gap-4 p-4 sm:p-5"
      >
        <img
          v-if="post.coverUrl"
          :src="post.coverUrl"
          :alt="post.title"
          loading="lazy"
          class="h-16 w-24 shrink-0 rounded-lg border object-cover sm:h-[104px] sm:w-[156px]"
        >
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <span
              v-if="post.categories[0]"
              class="font-medium text-primary/90"
            >{{ post.categories[0].name }}</span>
            <span
              v-if="post.categories[0]"
              class="text-muted-foreground/60"
            >·</span>
            <time class="text-muted-foreground">{{ formatDate(post.publishedAt) }}</time>
          </div>
          <h2 class="text-xl font-semibold leading-snug tracking-tight group-hover:text-primary">
            <template
              v-for="(seg, i) in segments(post.title)"
              :key="i"
            ><mark
              v-if="seg.hit"
              class="bg-primary/15 text-primary"
            >{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template>
          </h2>
          <p
            v-if="post.excerpt"
            class="line-clamp-2 text-sm leading-relaxed text-muted-foreground"
          >
            <template
              v-for="(seg, i) in segments(post.excerpt)"
              :key="i"
            ><mark
              v-if="seg.hit"
              class="bg-primary/15 text-primary"
            >{{ seg.text }}</mark><template v-else>{{ seg.text }}</template></template>
          </p>
          <p class="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span
              v-if="post.authorName"
            >{{ post.authorName }}</span>
            <span
              v-if="post.readingMinutes"
            >· ⏱ {{ t('posts.meta.readingTime', { n: post.readingMinutes }) }}</span>
            <span
              v-if="post.views"
            >· 👁 {{ t('posts.meta.views', { n: formatViews(post.views) }) }}</span>
          </p>
        </div>
      </NuxtLink>
    </article>
  </div>
</template>
