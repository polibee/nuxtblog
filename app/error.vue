<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
    <p class="text-7xl font-bold tracking-tight text-primary">
      {{ is404 ? '404' : '500' }}
    </p>
    <h1 class="mt-4 text-xl font-semibold">
      {{ is404 ? t('public.error.notFound') : t('public.error.serverError') }}
    </h1>
    <p class="mt-2 max-w-md text-sm text-muted-foreground">
      {{ is404 ? t('public.error.notFoundHint') : t('public.error.serverErrorHint') }}
    </p>
    <button
      type="button"
      class="mt-8 inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      @click="handleError"
    >
      {{ t('public.error.backHome') }}
    </button>
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
