<!-- eslint-disable vue/no-mutating-props -- items are local draft state owned by the manager page -->
<script setup lang="ts">
/* eslint-disable vue/no-mutating-props -- items are local draft state owned by the manager page */
import { GripVerticalIcon, ChevronDownIcon, ChevronRightIcon, EyeOffIcon, EyeIcon, TrashIcon, PencilIcon } from 'lucide-vue-next'

export interface EditorItem {
  uid: string
  label: string
  type: 'page' | 'post' | 'category' | 'custom'
  targetEntityType?: 'page' | 'post' | 'category'
  targetEntityId?: number
  targetSummary?: string
  customUrl?: string
  titleAttribute?: string
  openInNewTab?: boolean
  rel?: string
  nofollow?: boolean
  enabled: boolean
  expanded?: boolean
  editing?: boolean
  children: EditorItem[]
}

const props = defineProps<{
  item: EditorItem
  depth: number
  draggedUid: string | null
  maxDepth: number
}>()

const emit = defineEmits<{
  'drag-start': [uid: string]
  'drop': [payload: { draggedUid: string, targetUid: string, position: 'before' | 'after' | 'child' }]
  'keyboard-move': [payload: { uid: string, direction: 'up' | 'down' | 'out' }]
  'remove': [uid: string]
  'toggle': [uid: string]
}>()

const { t } = useI18n()

const showChildren = computed(() => props.item.expanded !== false)
const dropZone = ref<'before' | 'after' | 'child' | null>(null)

function onDragOver(event: DragEvent): void {
  if (!props.draggedUid || props.draggedUid === props.item.uid) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (event.clientY - rect.top) / rect.height
  const canNest = props.depth + 1 < props.maxDepth
  dropZone.value = ratio < 0.3 ? 'before' : ratio > 0.7 || !canNest ? 'after' : 'child'
  event.preventDefault()
}

function onDrop(): void {
  if (props.draggedUid && dropZone.value) {
    emit('drop', { draggedUid: props.draggedUid, targetUid: props.item.uid, position: dropZone.value })
  }
  dropZone.value = null
}
</script>

<template>
  <div>
    <div
      class="flex items-center gap-1 rounded-md border px-2 py-1.5"
      :class="{
        'border-t-2 border-t-primary': dropZone === 'before',
        'border-b-2 border-b-primary': dropZone === 'after',
        'ring-2 ring-primary': dropZone === 'child',
        'opacity-50': !item.enabled
      }"
      draggable="true"
      @dragstart="emit('drag-start', item.uid)"
      @dragover="onDragOver"
      @dragleave="dropZone = null"
      @drop.prevent="onDrop"
    >
      <GripVerticalIcon class="h-4 w-4 cursor-grab text-muted-foreground" />
      <button
        type="button"
        class="text-muted-foreground"
        @click="emit('toggle', item.uid)"
      >
        <ChevronDownIcon
          v-if="item.children.length && showChildren"
          class="h-4 w-4"
        />
        <ChevronRightIcon
          v-else-if="item.children.length"
          class="h-4 w-4"
        />
        <span
          v-else
          class="inline-block h-4 w-4"
        />
      </button>
      <span class="flex-1 truncate text-sm">
        {{ item.label }}
        <span class="ml-1 text-xs text-muted-foreground">({{ t(`res.navigation.type.${item.type}`) }}<template v-if="item.targetSummary">: {{ item.targetSummary }}</template>)</span>
        <span
          v-if="!item.enabled"
          class="ml-1 text-xs text-destructive"
        >{{ t('res.navigation.hidden') }}</span>
      </span>
      <button
        type="button"
        class="rounded p-1 hover:bg-accent"
        :title="t('res.menus.field.label')"
        @click="item.editing = !item.editing"
      >
        <PencilIcon class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="rounded p-1 hover:bg-accent"
        :title="item.enabled ? t('res.navigation.hide') : t('res.navigation.show')"
        @click="item.enabled = !item.enabled"
      >
        <EyeOffIcon
          v-if="item.enabled"
          class="h-3.5 w-3.5"
        />
        <EyeIcon
          v-else
          class="h-3.5 w-3.5"
        />
      </button>
      <button
        type="button"
        class="rounded p-1 hover:bg-accent"
        :title="t('common.delete')"
        @click="emit('remove', item.uid)"
      >
        <TrashIcon class="h-3.5 w-3.5 text-destructive" />
      </button>
    </div>

    <div
      v-if="item.editing"
      class="mt-1 mb-2 ml-6 grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3"
    >
      <label class="space-y-1 text-xs">
        <span>{{ t('res.navigation.field.label') }}</span>
        <input
          v-model="item.label"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm"
        >
      </label>
      <label
        v-if="item.type === 'custom'"
        class="space-y-1 text-xs"
      >
        <span>{{ t('res.navigation.field.url') }}</span>
        <input
          v-model="item.customUrl"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm"
        >
      </label>
      <label class="space-y-1 text-xs">
        <span>{{ t('res.navigation.field.titleAttribute') }}</span>
        <input
          v-model="item.titleAttribute"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm"
        >
      </label>
      <label class="space-y-1 text-xs">
        <span>{{ t('res.navigation.field.rel') }}</span>
        <input
          v-model="item.rel"
          class="h-8 w-full rounded-md border bg-background px-2 text-sm"
        >
      </label>
      <label class="flex items-center gap-2 text-xs">
        <input
          v-model="item.openInNewTab"
          type="checkbox"
        >
        {{ t('res.navigation.field.openInNewTab') }}
      </label>
      <label class="flex items-center gap-2 text-xs">
        <input
          v-model="item.nofollow"
          type="checkbox"
        >
        nofollow
      </label>
    </div>

    <div
      v-if="item.children.length && showChildren"
      class="ml-6 mt-1 space-y-1 border-l pl-2"
    >
      <NavigationTreeItem
        v-for="child in item.children"
        :key="child.uid"
        :item="child"
        :depth="depth + 1"
        :dragged-uid="draggedUid"
        :max-depth="maxDepth"
        @drag-start="emit('drag-start', $event)"
        @drop="emit('drop', $event)"
        @keyboard-move="emit('keyboard-move', $event)"
        @remove="emit('remove', $event)"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </div>
</template>
