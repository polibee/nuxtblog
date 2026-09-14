<script setup lang="ts">
const { t } = useI18n()
const { siteName } = useSiteSettings()
useHead({ title: t('maintenance.title') })
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 text-white">
    <div class="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-500/20 blur-3xl" />
    <main class="relative w-full max-w-2xl text-center">
      <div class="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl shadow-2xl shadow-cyan-950/40">
        ✦
      </div>
      <p class="mb-4 text-sm font-medium tracking-[0.24em] text-cyan-300">
        {{ siteName }}
      </p>
      <h1 class="text-4xl font-semibold tracking-tight sm:text-6xl">
        {{ t('maintenance.title') }}
      </h1>
      <p class="mx-auto mt-6 max-w-xl text-base leading-8 text-slate-300">
        {{ t('maintenance.description') }}
      </p>
      <div class="mt-10 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-300">
        <span class="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
        {{ t('maintenance.status') }}
      </div>
    </main>
  </div>
</template>
