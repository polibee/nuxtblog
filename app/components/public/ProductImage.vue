<template>
  <img
  v-if="src"
  :src="src"
  :alt="alt"
  class="product-image"
  :loading="eager ? 'eager' : 'lazy'"
  :fetchpriority="eager ? 'high' : undefined"
>
  <div v-else class="product-image product-image--placeholder" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-8 w-8">
      <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0 0 21.75 19.5V4.5A1.5 1.5 0 0 0 20.25 3H3.75A1.5 1.5 0 0 0 2.25 4.5v15A1.5 1.5 0 0 0 3.75 21Z" />
    </svg>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  image?: { url: string } | null
  alt?: string
  /** above-the-fold hero images must not be lazy (LCP) */
  eager?: boolean
}>()

const src = computed(() => props.image?.url ?? '')
const alt = computed(() => props.alt ?? '')
</script>

<style scoped>
.product-image {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 0.5rem;
  border: 1px solid var(--border, #e5e7eb);
}

.product-image--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-foreground, #9ca3af);
  background:
    repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(127, 127, 127, 0.06) 10px, rgba(127, 127, 127, 0.06) 20px),
    var(--muted, #f3f4f6);
}
</style>
