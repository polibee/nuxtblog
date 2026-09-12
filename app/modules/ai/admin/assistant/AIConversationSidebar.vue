<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { PlusIcon, Trash2Icon } from 'lucide-vue-next'

/* C2 conversation sidebar (§52): Today / Yesterday / Previous groups +
   delete. Rename/Archive come with the preset phase. */

interface Conversation { id: number, title: string, scopeType: string, updatedAt: string }

const props = defineProps<{
  conversations: Conversation[]
  activeId: number | null
}>()

const emit = defineEmits<{
  'select': [id: number]
  'new-chat': []
  'remove': [id: number]
}>()

const { t } = useI18n()

const groups = computed(() => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86_400_000
  const startOf7Days = startOfToday - 7 * 86_400_000
  const sorted = [...props.conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const updated = (c: Conversation) => new Date(c.updatedAt).getTime()
  return [
    { label: t('res.aichat.groupToday'), items: sorted.filter(c => updated(c) >= startOfToday) },
    { label: t('res.aichat.groupYesterday'), items: sorted.filter(c => updated(c) < startOfToday && updated(c) >= startOfYesterday) },
    { label: t('res.aichat.groupPrevious'), items: sorted.filter(c => updated(c) < startOf7Days) }
  ].filter(g => g.items.length > 0)
})
</script>

<template>
  <div class="flex h-full flex-col gap-2">
    <UiButton
      class="w-full"
      variant="outline"
      @click="emit('new-chat')"
    >
      <PlusIcon class="mr-1 h-4 w-4" />{{ t('res.aichat.newChat') }}
    </UiButton>
    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
      <div
        v-for="group in groups"
        :key="group.label"
        class="space-y-1"
      >
        <p class="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {{ group.label }}
        </p>
        <div
          v-for="conv in group.items"
          :key="conv.id"
          class="group flex items-center gap-1 rounded-md pl-1 transition-colors hover:bg-accent"
          :class="conv.id === activeId ? 'bg-accent' : ''"
        >
          <button
            type="button"
            class="min-w-0 flex-1 truncate py-2 text-left text-sm"
            @click="emit('select', conv.id)"
          >
            {{ conv.title || t('res.aichat.newChat') }}
          </button>
          <button
            type="button"
            class="mr-1 hidden h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive group-hover:flex"
            :title="t('res.aichat.delete')"
            @click="emit('remove', conv.id)"
          >
            <Trash2Icon class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p
        v-if="conversations.length === 0"
        class="px-1 text-xs text-muted-foreground"
      >
        {{ t('res.aichat.noConversations') }}
      </p>
    </div>
  </div>
</template>
