<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4 text-foreground">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-accent/40 blur-3xl"
    />

    <main class="relative w-full max-w-lg rounded-3xl border bg-background/95 p-8 text-center shadow-xl shadow-primary/5 backdrop-blur sm:p-12">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <span class="text-xl font-semibold">{{ is404 ? '⌕' : '!' }}</span>
      </div>
      <p class="mt-7 text-6xl font-semibold tracking-[-0.06em] text-foreground sm:text-7xl">
        {{ is404 ? '404' : '500' }}
      </p>
      <h1 class="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
        {{ is404 ? t('public.error.notFound') : t('public.error.serverError') }}
      </h1>
      <p class="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
        {{ is404 ? t('public.error.notFoundHint') : t('public.error.serverErrorHint') }}
      </p>
      <button
        type="button"
        class="mt-8 inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        @click="handleError"
      >
        {{ t('public.error.backHome') }}
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
  } | null
}>()

const { t } = useI18n()

const is404 = computed(() => props.error?.statusCode === 404)

function handleError(): void {
  clearError({ redirect: '/' })
}
</script>
