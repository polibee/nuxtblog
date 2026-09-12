<script setup lang="ts">
const { t } = useI18n()
const visible = ref(false)

function onScroll(): void {
  visible.value = window.scrollY > 600
}

function backToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <Transition name="fade">
    <button
      v-if="visible"
      type="button"
      class="fixed bottom-6 right-6 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background/95 shadow-sm backdrop-blur transition-colors hover:bg-accent"
      :aria-label="t('public.post.backToTop')"
      @click="backToTop"
    >
      ↑
    </button>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
