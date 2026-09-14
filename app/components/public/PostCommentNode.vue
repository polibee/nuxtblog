<script setup lang="ts">
import type { PublicComment } from '#shared/schemas/comment'

defineOptions({ name: 'PostCommentNode' })

const props = defineProps<{
  comment: PublicComment
  depth: number
  highlightedId: number | null
  replyTarget: PublicComment | null
  replyContent: string
  replySubmitting: boolean
  expandedThreads: ReadonlySet<number>
  indentClass: (depth: number) => string
  avatarClass: (name: string) => string
  relativeTime: (iso: string) => string
  visibleReplies: (comment: PublicComment) => PublicComment[]
  hiddenReplyCount: (comment: PublicComment) => number
  openReply: (comment: PublicComment) => void
  copyPermalink: (comment: PublicComment) => void
  toggleThread: (comment: PublicComment) => void
  submitReply: () => Promise<void>
}>()

const emit = defineEmits<{
  'update:replyContent': [value: string]
  'cancel-reply': []
}>()

const { t } = useI18n()

function onReplyContentInput(event: Event): void {
  if (event.target instanceof HTMLTextAreaElement) {
    emit('update:replyContent', event.target.value)
  }
}

function updateReplyContent(value: string): void {
  emit('update:replyContent', value)
}

function cancelReply(): void {
  emit('cancel-reply')
}
</script>

<template>
  <div>
    <div
      :id="`comment-${comment.id}`"
      class="flex gap-3 transition-all duration-700"
      :class="highlightedId === comment.id ? 'rounded-lg bg-muted/40 ring-1 ring-primary/20' : ''"
    >
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        :class="avatarClass(comment.authorName)"
      >
        <img
          v-if="comment.avatarUrl"
          :src="comment.avatarUrl"
          alt=""
          class="h-full w-full rounded-full object-cover"
        >
        <template v-else>{{ comment.authorName.slice(0, 1).toUpperCase() }}</template>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm">
          <a
            v-if="comment.websiteUrl"
            :href="comment.websiteUrl"
            target="_blank"
            rel="nofollow noopener noreferrer"
            class="font-semibold hover:underline"
          >{{ comment.authorName }}</a>
          <span v-else class="font-semibold">{{ comment.authorName }}</span>
          <span
            v-for="badge in comment.badges"
            :key="`${comment.id}-${badge.key}`"
            class="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-medium text-primary"
            :title="badge.description"
          >
            {{ badge.name }}
          </span>
          <span class="ml-1.5 text-xs text-muted-foreground">{{ relativeTime(comment.createdAt) }}</span>
          <span v-if="comment.browserName || comment.osName" class="ml-1.5 text-xs text-muted-foreground">
            · {{ [comment.browserName, comment.osName].filter(Boolean).join(' / ') }}
          </span>
        </p>
        <p class="mt-1 text-[15px] leading-[1.7]">
          {{ comment.content }}
        </p>
        <div class="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
          <button
            type="button"
            class="hover:text-foreground"
            @click="openReply(comment)"
          >
            {{ t('public.comments.reply') }}
          </button>
          <button
            type="button"
            class="hover:text-foreground"
            :title="t('public.comments.copyLink')"
            @click="copyPermalink(comment)"
          >
            ···
          </button>
        </div>
      </div>
    </div>

    <!-- inline reply composer (§32/33) -->
    <div
      v-if="replyTarget?.id === comment.id"
      :id="`reply-composer-${comment.id}`"
      class="ml-11 rounded-lg border p-3"
    >
      <p class="mb-2 text-xs text-muted-foreground">
        {{ t('public.comments.replyingToName', { name: comment.authorName }) }}
        <button
          type="button"
          class="ml-1 text-destructive hover:underline"
          @click="cancelReply"
        >
          {{ t('common.cancel') }}
        </button>
      </p>
      <form
        class="space-y-2"
        @submit.prevent="submitReply"
      >
        <textarea
          :value="replyContent"
          rows="2"
          maxlength="3000"
          :placeholder="t('public.comments.replyPlaceholder', { name: comment.authorName })"
          class="w-full rounded-md border bg-background px-3 py-2 text-sm"
          required
          @input="onReplyContentInput"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent"
            @click="cancelReply"
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

    <div
      v-if="comment.children.length && depth < 3"
      :class="[indentClass(depth + 1), 'space-y-4 border-l border-muted pl-5']"
    >
      <PostCommentNode
        v-for="reply in visibleReplies(comment)"
        :key="reply.id"
        :comment="reply"
        :depth="depth + 1"
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
        @update:reply-content="updateReplyContent"
        @cancel-reply="cancelReply"
      />

      <button
        v-if="hiddenReplyCount(comment) > 0"
        type="button"
        class="text-xs text-muted-foreground hover:text-primary"
        @click="toggleThread(comment)"
      >
        ↳ {{ expandedThreads.has(comment.id) ? t('public.comments.collapseReplies') : t('public.comments.moreReplies', { n: hiddenReplyCount(comment) }) }}
      </button>
    </div>
  </div>
</template>
