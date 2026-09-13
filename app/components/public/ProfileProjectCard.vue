<script setup lang="ts">
import { ArrowUpRightIcon } from 'lucide-vue-next'
import { createProjectPlaceholder } from '#shared/utils/project-placeholder'

interface ProfileProject {
  name: string
  description: string
  image: string | null
  url: string
  githubUrl: string
  tags: string[]
  featured: boolean
}

const props = defineProps<{
  project: ProfileProject
  index: number
}>()

const { t } = useI18n()

const placeholderStyles = [
  { panel: 'bg-[#18212f]', accent: 'bg-[#89a8c7]', line: 'border-[#d9e4ef]/30' },
  { panel: 'bg-[#25221d]', accent: 'bg-[#d5aa72]', line: 'border-[#f2e0c5]/30' },
  { panel: 'bg-[#1a2524]', accent: 'bg-[#72c2b6]', line: 'border-[#d4f2ed]/30' },
  { panel: 'bg-[#242031]', accent: 'bg-[#a898d4]', line: 'border-[#e8e0ff]/30' }
] as const

const placeholder = computed(() => {
  const base = createProjectPlaceholder(props.project.name)
  return { ...base, ...placeholderStyles[base.variant] }
})

const isExternal = (url: string) => /^https?:\/\//i.test(url)
</script>

<template>
  <article class="group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
    <div class="relative aspect-[16/9] overflow-hidden bg-muted">
      <img
        v-if="project.image"
        :src="project.image"
        :alt="project.name"
        loading="lazy"
        decoding="async"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      >
      <div
        v-else
        class="relative h-full w-full overflow-hidden text-white"
        :class="placeholder.panel"
        role="img"
        :aria-label="`${t('public.profile.projectPlaceholder')}: ${project.name}`"
      >
        <div
          class="absolute -right-8 -top-12 h-36 w-36 rotate-12 rounded-[2rem] opacity-80"
          :class="placeholder.accent"
        />
        <div
          class="absolute bottom-4 right-8 h-16 w-16 rounded-full border-8"
          :class="placeholder.line"
        />
        <div class="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:24px_24px]" />
        <div class="relative flex h-full flex-col justify-between p-4">
          <div class="flex items-center justify-between text-[10px] font-medium tracking-[0.16em] text-white/60">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ t('public.profile.projectMark') }}</span>
          </div>
          <div class="flex items-end justify-between gap-4">
            <p class="truncate text-lg font-semibold tracking-tight">
              {{ project.name }}
            </p>
            <span class="shrink-0 text-4xl font-semibold tracking-[-0.08em] text-white/90">{{ placeholder.monogram }}</span>
          </div>
        </div>
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
      <span
        v-if="project.featured"
        class="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur"
      >{{ t('public.profile.featured') }}</span>
      <span class="absolute bottom-3 left-3 text-xs font-medium text-white/90">
        {{ project.tags[0] || t('public.profile.project') }}
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-3 p-5">
      <h3 class="text-lg font-semibold leading-tight tracking-tight">
        {{ project.name }}
      </h3>
      <p
        v-if="project.description"
        class="line-clamp-3 text-sm leading-6 text-muted-foreground"
      >
        {{ project.description }}
      </p>
      <div
        v-if="project.tags.length"
        class="flex flex-wrap gap-1"
      >
        <span
          v-for="tag in project.tags"
          :key="tag"
          class="rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
        >{{ tag }}</span>
      </div>
      <div class="mt-auto flex flex-wrap gap-2 pt-2 text-sm">
        <a
          v-if="project.url"
          :href="project.url"
          :target="isExternal(project.url) ? '_blank' : undefined"
          :rel="isExternal(project.url) ? 'nofollow noopener noreferrer' : undefined"
          class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-primary-foreground transition-opacity hover:opacity-90"
        >{{ t('public.profile.visit') }}<ArrowUpRightIcon class="h-3.5 w-3.5" /></a>
        <a
          v-if="project.githubUrl"
          :href="project.githubUrl"
          target="_blank"
          rel="nofollow noopener noreferrer"
          class="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >{{ t('public.profile.github') }}</a>
      </div>
    </div>
  </article>
</template>
