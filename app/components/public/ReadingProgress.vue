<script setup lang="ts">
const progress = ref(0)

function onScroll(): void {
  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
    aria-hidden="true"
  >
    <div
      class="h-full bg-primary transition-[width] duration-150"
      :style="{ width: `${progress}%` }"
    />
  </div>
</template>
