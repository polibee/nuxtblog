<script setup lang="ts">
import NavigationTreeItem from './NavigationTreeItem.vue'
import type { EditorItem } from './NavigationTreeItem.vue'

defineProps<{
  items: EditorItem[]
  draggedUid: string | null
  maxDepth: number
}>()

const { t } = useI18n()

const emit = defineEmits<{
  'drag-start': [uid: string]
  'drop': [payload: { draggedUid: string, targetUid: string, position: 'before' | 'after' | 'child' }]
  'keyboard-move': [payload: { uid: string, direction: 'up' | 'down' | 'out' }]
  'remove': [uid: string]
}>()
</script>

<template>
  <div class="space-y-1">
    <UiEmpty v-if="items.length === 0">
      <template #title>
        {{ t('res.navigation.emptyTree') }}
      </template>
    </UiEmpty>
    <NavigationTreeItem
      v-for="item in items"
      :key="item.uid"
      :item="item"
      :depth="0"
      :dragged-uid="draggedUid"
      :max-depth="maxDepth"
      @drag-start="emit('drag-start', $event)"
      @drop="emit('drop', $event)"
      @keyboard-move="emit('keyboard-move', $event)"
      @remove="emit('remove', $event)"
    />
  </div>
</template>
