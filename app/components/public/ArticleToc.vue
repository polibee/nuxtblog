<script setup lang="ts">
import type { TocItem } from '~/utils/blog'

const props = defineProps<{
  items: TocItem[]
}>()

const { t } = useI18n()
const activeId = ref('')
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) activeId.value = entry.target.id
    }
  }, { rootMargin: '-72px 0px -70% 0px' })
  for (const item of props.items) {
    const el = document.getElementById(item.id)
    if (el) observer.observe(el)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <nav
    class="rounded-xl border bg-muted/30 p-4"
    :aria-label="t('public.post.toc')"
  >
    <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {{ t('public.post.toc') }}
    </p>
    <ol class="space-y-1 text-sm">
      <li
        v-for="item in items"
        :key="item.id"
        :class="item.level === 3 ? 'pl-4' : ''"
      >
        <a
          :href="`#${item.id}`"
          class="block truncate py-0.5 transition-colors hover:text-primary"
          :class="activeId === item.id ? 'font-medium text-primary' : 'text-muted-foreground'"
        >
          {{ item.text }}
        </a>
      </li>
    </ol>
  </nav>
</template>
