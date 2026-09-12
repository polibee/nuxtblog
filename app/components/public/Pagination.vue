<script setup lang="ts">
const props = defineProps<{
  page: number
  total: number
  perPage: number
}>()

const { t } = useI18n()
const route = useRoute()

const totalPages = computed(() => Math.max(Math.ceil(props.total / props.perPage), 1))

const pages = computed(() => {
  const total = totalPages.value
  let start = Math.max(1, props.page - 2)
  const end = Math.min(total, start + 4)
  start = Math.max(1, end - 4)
  const list: number[] = []
  for (let i = start; i <= end; i++) list.push(i)
  return list
})

/* plain anchors: classic pagination keeps SSR full navigation (SEO + back button) */
function href(target: number): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') params.set(key, value)
  }
  if (target <= 1) params.delete('page')
  else params.set('page', String(target))
  const qs = params.toString()
  return qs ? `${route.path}?${qs}` : route.path
}
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="flex flex-wrap items-center justify-center gap-2 pt-2"
    aria-label="Pagination"
  >
    <a
      v-if="page > 1"
      :href="href(page - 1)"
      class="inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors hover:bg-accent"
    >
      ← {{ t('public.posts.prevPage') }}
    </a>
    <span
      v-else
      class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground/50"
    >
      ← {{ t('public.posts.prevPage') }}
    </span>

    <a
      v-for="p in pages"
      :key="p"
      :href="href(p)"
      class="inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm transition-colors hover:bg-accent"
      :aria-current="p === page ? 'page' : undefined"
      :class="p === page ? 'border-primary bg-primary text-primary-foreground' : ''"
    >
      {{ p }}
    </a>

    <a
      v-if="page < totalPages"
      :href="href(page + 1)"
      class="inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors hover:bg-accent"
    >
      {{ t('public.posts.nextPage') }} →
    </a>
    <span
      v-else
      class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground/50"
    >
      {{ t('public.posts.nextPage') }} →
    </span>
  </nav>
</template>
