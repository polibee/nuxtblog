<script setup lang="ts">
import { CheckCircle2Icon, Clock3Icon, FilePenLineIcon, FileTextIcon, LayoutTemplateIcon, UsersIcon } from 'lucide-vue-next'
import { useI18n } from '~/admin/i18n'

const { t } = useI18n()

interface Stats {
  usersTotal: number
  usersActive: number
  postsPublished: number
  postsDraft: number
  pendingComments: number
  approvedComments: number
  pagesPublished: number
}

const stats = ref<Stats | null>(null)

onMounted(async () => {
  try {
    stats.value = await $fetch<Stats>('/api/admin/stats')
  } catch {
    stats.value = null
  }
})

const cards = computed(() => [
  {
    label: t('widget.totalUsers'),
    value: stats.value?.usersTotal,
    sub: t('widget.active', { n: stats.value?.usersActive ?? 0 }),
    icon: UsersIcon
  },
  {
    label: t('widget.activeUsers'),
    value: stats.value?.usersActive,
    sub: t('widget.activeUsersHint'),
    icon: UsersIcon
  },
  {
    label: t('status.published'),
    value: stats.value?.postsPublished,
    sub: t('widget.postsPublishedHint'),
    icon: FileTextIcon
  },
  {
    label: t('status.draft'),
    value: stats.value?.postsDraft,
    sub: t('widget.postsDraftHint'),
    icon: FilePenLineIcon
  },
  {
    label: t('res.comments.status.pending'),
    value: stats.value?.pendingComments,
    sub: t('widget.pendingComments', { n: stats.value?.pendingComments ?? 0 }),
    icon: Clock3Icon
  },
  {
    label: t('res.comments.status.approved'),
    value: stats.value?.approvedComments,
    sub: t('widget.approvedCommentsHint'),
    icon: CheckCircle2Icon
  },
  {
    label: t('widget.pages'),
    value: stats.value?.pagesPublished,
    sub: t('widget.pagesPublishedHint'),
    icon: LayoutTemplateIcon
  }
])
</script>

<template>
  <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
    <UiCard
      v-for="card in cards"
      :key="card.label"
      class="p-5"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted-foreground">{{ card.label }}</span>
        <component
          :is="card.icon"
          class="h-4 w-4 text-muted-foreground"
        />
      </div>
      <p class="mt-2 text-2xl font-semibold tabular-nums">
        {{ card.value ?? '—' }}
      </p>
      <p
        v-if="card.sub"
        class="mt-1 text-xs text-muted-foreground"
      >
        {{ card.sub }}
      </p>
    </UiCard>
  </div>
</template>
