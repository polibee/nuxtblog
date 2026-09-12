<script setup lang="ts">
import { useI18n } from '~/admin/i18n'
import { PlusIcon, SearchIcon, XIcon } from 'lucide-vue-next'

/* C2 §38 context picker: search entities and attach them as chips.
   Entities only — file attachments are a later phase (§39). */

interface ContextItem { type: string, id: number, title: string }
interface SearchItem { type: string, id: number, title: string, status: string }

const props = defineProps<{ attached: ContextItem[] }>()

const emit = defineEmits<{
  attach: [item: ContextItem]
  detach: [item: ContextItem]
}>()

const { t } = useI18n()

const open = ref(false)
const query = ref('')
const results = ref<SearchItem[]>([])
const searching = ref(false)

async function search(): Promise<void> {
  if (query.value.trim().length < 2) {
    results.value = []
    return
  }
  searching.value = true
  try {
    const res = await $fetch<{ items: SearchItem[] }>('/api/admin/ai/chat/context-search', {
      query: { q: query.value.trim() }
    })
    results.value = res.items ?? []
  } catch {
    results.value = []
  } finally {
    searching.value = false
  }
}

watch(query, () => void search())

function isAttached(item: SearchItem): boolean {
  return props.attached.some(a => a.type === item.type && a.id === item.id)
}

function typeLabel(type: string): string {
  return t(`res.aichat.source_${type}`)
}
</script>

<template>
  <div class="space-y-1.5">
    <div
      v-if="attached.length > 0"
      class="flex flex-wrap gap-1.5"
    >
      <span
        v-for="item in attached"
        :key="`${item.type}-${item.id}`"
        class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
      >
        {{ typeLabel(item.type) }} · {{ item.title }}
        <button
          type="button"
          class="hover:text-destructive"
          @click="emit('detach', item)"
        >
          <XIcon class="h-3 w-3" />
        </button>
      </span>
    </div>

    <div
      v-if="open"
      class="space-y-2 rounded-lg border p-2"
    >
      <div class="flex items-center gap-2">
        <SearchIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          v-model="query"
          type="search"
          :placeholder="t('res.aichat.contextSearch')"
          class="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
      </div>
      <p
        v-if="searching"
        class="text-xs text-muted-foreground"
      >
        {{ t('res.aichat.searching') }}
      </p>
      <div
        v-else-if="results.length > 0"
        class="max-h-48 space-y-0.5 overflow-y-auto"
      >
        <button
          v-for="item in results"
          :key="`${item.type}-${item.id}`"
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
          :disabled="isAttached(item)"
          @click="emit('attach', { type: item.type, id: item.id, title: item.title })"
        >
          <span class="min-w-0 truncate">
            <span class="text-xs text-muted-foreground">{{ typeLabel(item.type) }} · </span>{{ item.title }}
          </span>
          <PlusIcon
            v-if="!isAttached(item)"
            class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
        </button>
      </div>
      <p
        v-else-if="query.trim().length >= 2"
        class="text-xs text-muted-foreground"
      >
        {{ t('res.aichat.contextNoResults') }}
      </p>
    </div>

    <button
      type="button"
      class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      @click="open = !open"
    >
      <PlusIcon class="h-3.5 w-3.5" />
      {{ open ? t('res.aichat.contextClose') : t('res.aichat.contextAdd') }}
    </button>
  </div>
</template>
